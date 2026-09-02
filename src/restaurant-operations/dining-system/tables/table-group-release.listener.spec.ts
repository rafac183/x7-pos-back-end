import { TableGroupReleaseListener } from './table-group-release.listener';
import type { Repository } from 'typeorm';
import type { Order } from '../../pos/orders/entities/order.entity';
import type { Table } from './entities/table.entity';
import type { TablesService } from './tables.service';

/** Deja correr el setImmediate con el que el listener se aparta del camino del cobro. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('TableGroupReleaseListener', () => {
  const build = (order: unknown, table: unknown) => {
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue(order),
    } as unknown as Repository<Order>;
    const tableRepo = {
      findOne: jest.fn().mockResolvedValue(table),
    } as unknown as Repository<Table>;
    const tablesService = {
      releaseJoinedGroup: jest.fn().mockResolvedValue(undefined),
    } as unknown as TablesService & { releaseJoinedGroup: jest.Mock };

    return {
      listener: new TableGroupReleaseListener(orderRepo, tableRepo, tablesService),
      tablesService,
    };
  };

  it('suelta el grupo de la mesa que pagó', async () => {
    const { listener, tablesService } = build(
      { id: 120, table_id: 4 },
      { id: 4, parent_table_id: null },
    );

    listener.handleOrderFullyPaid({ orderId: 120 });
    await flush();

    expect(tablesService.releaseJoinedGroup).toHaveBeenCalledWith(4);
  });

  it('si la cuenta estaba a nombre de una mesa hija, libera el grupo desde la madre', async () => {
    const { listener, tablesService } = build(
      { id: 120, table_id: 5 },
      { id: 5, parent_table_id: 4 },
    );

    listener.handleOrderFullyPaid({ orderId: 120 });
    await flush();

    expect(tablesService.releaseJoinedGroup).toHaveBeenCalledWith(4);
  });

  it('una comanda sin mesa (mostrador, delivery) no toca ninguna sala', async () => {
    const { listener, tablesService } = build({ id: 120, table_id: null }, null);

    listener.handleOrderFullyPaid({ orderId: 120 });
    await flush();

    expect(tablesService.releaseJoinedGroup).not.toHaveBeenCalled();
  });

  it('un evento sin orderId se ignora', async () => {
    const { listener, tablesService } = build(null, null);

    listener.handleOrderFullyPaid({ orderId: undefined as unknown as number });
    await flush();

    expect(tablesService.releaseJoinedGroup).not.toHaveBeenCalled();
  });

  it('un fallo al liberar no escala: la cuenta ya está cobrada', async () => {
    const { listener, tablesService } = build(
      { id: 120, table_id: 4 },
      { id: 4, parent_table_id: null },
    );
    tablesService.releaseJoinedGroup.mockRejectedValue(new Error('db down'));

    expect(() => listener.handleOrderFullyPaid({ orderId: 120 })).not.toThrow();
    await flush();
    await flush();
  });
});
