import { Injectable, Logger } from '@nestjs/common';
import { RealtimeEventBusService } from 'src/realtime/realtime-event-bus.service';
import { merchantRoom } from 'src/realtime/realtime.constants';
import {
  DINING_EVENTS,
  type AssignmentChangedPayload,
  type FloorPlanUpdatedPayload,
  type TableStatusChangedPayload,
  type TableTransferredPayload,
} from './constants/dining-realtime.events';

/**
 * Publica los cambios de sala a las tablets del comercio.
 *
 * Todo lo que sale de aquí es "para enterarse", nunca la fuente de verdad: si el gateway
 * está caído (WS_ENABLED=false, sin servidor bindeado) la operación que lo invocó ya se ha
 * persistido y NO debe romperse por no poder avisar. Por eso cada emisión va envuelta:
 * un socket mudo no puede tumbar el cobro de una mesa.
 */
@Injectable()
export class DiningRealtimePublisher {
  private readonly logger = new Logger(DiningRealtimePublisher.name);

  constructor(private readonly bus: RealtimeEventBusService) {}

  tableStatusChanged(payload: Omit<TableStatusChangedPayload, 'emittedAt'>): void {
    this.emit(DINING_EVENTS.TABLE_STATUS_CHANGED, payload.merchantId, payload);
  }

  tableTransferred(payload: Omit<TableTransferredPayload, 'emittedAt'>): void {
    this.emit(DINING_EVENTS.TABLE_TRANSFERRED, payload.merchantId, payload);
  }

  assignmentChanged(payload: Omit<AssignmentChangedPayload, 'emittedAt'>): void {
    this.emit(DINING_EVENTS.ASSIGNMENT_CHANGED, payload.merchantId, payload);
  }

  floorPlanUpdated(payload: Omit<FloorPlanUpdatedPayload, 'emittedAt'>): void {
    this.emit(DINING_EVENTS.FLOOR_PLAN_UPDATED, payload.merchantId, payload);
  }

  private emit(
    event: string,
    merchantId: number,
    payload: Record<string, unknown>,
  ): void {
    try {
      this.bus.emitToRoom(merchantRoom(merchantId), event, {
        ...payload,
        // Marca de emisión: es lo que el cliente usa como agua para pedir el delta al
        // reconectar, así que la pone el servidor y no cada tablet con su propio reloj.
        emittedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      this.logger.warn(`Realtime emit skipped for ${event}: ${e.message}`);
    }
  }
}
