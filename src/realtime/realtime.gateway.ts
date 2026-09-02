import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import type { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RealtimeEventBusService } from './realtime-event-bus.service';
import { RealtimeAuthService } from './realtime-auth.service';
import {
  companyRoom,
  merchantRoom,
  REALTIME_CORS_ORIGIN_DEFAULT,
  REALTIME_NAMESPACE_DEFAULT,
} from './realtime.constants';
import type { RealtimeSocket } from './realtime-socket.types';

function getConnectErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Authentication failed';
}

function parseBearerToken(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  return match?.[1]?.trim() || undefined;
}

function parseCorsOrigin(raw: string | undefined): string | string[] {
  const v = raw?.trim();
  if (!v || v === '*') return '*';
  if (v.includes(','))
    return v
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
  return v;
}

@WebSocketGateway({
  namespace: REALTIME_NAMESPACE_DEFAULT,
  cors: { origin: REALTIME_CORS_ORIGIN_DEFAULT },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger('RealtimeGateway');

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly config: ConfigService,
    private readonly eventBus: RealtimeEventBusService,
    private readonly realtimeAuth: RealtimeAuthService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.eventBus.bindServer(server);

    const namespace = this.config.get<string>('WS_NAMESPACE');
    if (namespace && namespace !== REALTIME_NAMESPACE_DEFAULT) {
      this.logger.warn(
        `WS_NAMESPACE is set to "${namespace}" but the gateway namespace is static. Update RealtimeGateway if you need a custom namespace.`,
      );
    }

    const origin = parseCorsOrigin(this.config.get<string>('WS_CORS_ORIGIN'));
    if (origin !== REALTIME_CORS_ORIGIN_DEFAULT) {
      server.engine.opts.cors = {
        ...(server.engine.opts.cors ?? {}),
        origin,
      };
    }
  }

  async handleConnection(client: RealtimeSocket) {
    const wsEnabled = this.config.get<string>('WS_ENABLED');
    if (wsEnabled && wsEnabled.toLowerCase() === 'false') {
      client.emit('realtime.error', { message: 'WebSockets are disabled' });
      client.disconnect(true);
      return;
    }

    const authHeader = String(client.handshake.headers.authorization ?? '');
    const headerToken = parseBearerToken(authHeader);
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token.trim()
        : undefined;
    const token = authToken || headerToken;

    if (!token) {
      client.emit('realtime.error', { message: 'Missing token' });
      client.disconnect(true);
      return;
    }

    try {
      const user = await this.realtimeAuth.authenticateToken(token);
      client.data.user = user;

      // Tenant rooms: these are the baseline rooms most use-cases need.
      const companyId = user.companyId;
      await client.join(companyRoom(companyId));

      // Merchant room: floor-level events (dining tables, assignments, floor plans) belong
      // to a single venue, not to every venue the company owns.
      const merchantId = user.merchant?.id;
      if (merchantId) {
        await client.join(merchantRoom(merchantId));
      }

      client.emit('realtime.connected', {
        userId: user.id,
        companyId,
        merchantId,
      });
    } catch (error: unknown) {
      const message = getConnectErrorMessage(error);
      client.emit('realtime.error', { message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: RealtimeSocket) {
    const userId = client.data.user?.id;
    if (userId) {
      this.logger.debug(`Client disconnected userId=${userId}`);
    }
  }
}
