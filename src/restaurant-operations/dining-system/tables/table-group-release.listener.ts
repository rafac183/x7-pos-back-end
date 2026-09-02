import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ORDER_FULLY_PAID_EVENT,
  type OrderFullyPaidPayload,
} from 'src/inventory/sale-inventory/order-paid.events';
import { Order } from '../../pos/orders/entities/order.entity';
import { TablesService } from './tables.service';
import { Table } from './entities/table.entity';

/**
 * Suelta el grupo de mesas unidas cuando se salda la cuenta.
 *
 * Sin esto, unir tres mesas para un cumpleaños deja las tres 'occupied' y encadenadas
 * después de que el grupo se marche: el POS sigue viéndolas llenas y la sala se queda sin
 * mesas fantasma que nadie puede volver a sentar.
 *
 * Se engancha al mismo evento que ya usan inventario y fidelización, así que el cobro no
 * espera a esto ni se rompe si falla: el error se registra y la cuenta queda cobrada igual.
 */
@Injectable()
export class TableGroupReleaseListener {
  private readonly logger = new Logger(TableGroupReleaseListener.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    private readonly tablesService: TablesService,
  ) {}

  @OnEvent(ORDER_FULLY_PAID_EVENT)
  handleOrderFullyPaid(payload: OrderFullyPaidPayload): void {
    setImmediate(() => {
      void this.release(payload).catch((err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err));
        this.logger.error(
          `Table group release failed for order ${payload?.orderId}: ${e.message}`,
          e.stack,
        );
      });
    });
  }

  private async release(payload: OrderFullyPaidPayload): Promise<void> {
    if (!payload?.orderId) return;

    const order = await this.orderRepo.findOne({
      where: { id: payload.orderId },
    });
    if (!order?.table_id) return;

    const table = await this.tableRepo.findOne({
      where: { id: order.table_id },
    });
    if (!table) return;

    // La cuenta puede estar a nombre de una mesa hija: quien manda sobre el grupo es la
    // madre, así que se sube un nivel antes de soltar a nadie.
    const groupRootId = table.parent_table_id ?? table.id;
    await this.tablesService.releaseJoinedGroup(groupRootId);
  }
}
