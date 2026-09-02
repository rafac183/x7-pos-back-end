/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TablesService } from './tables.service';
import { Table } from './entities/table.entity';
import { TableTransferLog } from './entities/table-transfer-log.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { FloorPlan } from '../floor-plan/entity/floor-plan.entity';
import { FloorZone } from '../floor-zone/entity/floor-zone.entity';
import { Order } from '../../pos/orders/entities/order.entity';
import { TableAssignment } from '../table-assignments/entities/table-assignment.entity';
import { DiningRealtimePublisher } from '../dining-realtime.publisher';
import { TableStatus } from '../constants/table-status.enum';

/**
 * Operaciones de sala: traslado de comensales, guardas de servicio vivo, propagación de
 * estado en un grupo unido y delta de reconciliación.
 */
describe('TablesService · floor operations', () => {
  let service: TablesService;

  const MERCHANT_ID = 1;
  const USER_ID = 7;

  const merchant = { id: MERCHANT_ID, name: 'Test Merchant' };

  const makeTable = (over: Partial<Table>): Table =>
    ({
      id: 1,
      merchant_id: MERCHANT_ID,
      number: 'A1',
      capacity: 4,
      status: TableStatus.AVAILABLE,
      location: 'Main',
      rotation: 0,
      shape: 'Square',
      width: null,
      height: null,
      pos_x: 0,
      pos_y: 0,
      merchant,
      parentTable: null,
      parent_table_id: null,
      ...over,
    }) as unknown as Table;

  // ---- repos del servicio (fuera de transacción) ----
  const tableRepo = {
    create: jest.fn(),
    save: jest.fn((t: unknown) => Promise.resolve(t)),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(),
  };
  const merchantRepo = { findOne: jest.fn() };
  const floorZoneRepo = { findOne: jest.fn() };
  const floorPlanRepo = { findOne: jest.fn() };
  const orderRepo = {
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const assignmentQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const assignmentRepo = {
    createQueryBuilder: jest.fn(() => assignmentQb),
    save: jest.fn(),
  };
  const transferLogRepo = { save: jest.fn() };

  // ---- repos dentro de la transacción ----
  const txTableRepo = {
    findOne: jest.fn(),
    save: jest.fn((t: unknown) => Promise.resolve(t)),
    find: jest.fn().mockResolvedValue([]),
  };
  const txOrderRepo = { findOne: jest.fn(), save: jest.fn() };
  const txAssignmentQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
  };
  const txAssignmentRepo = {
    createQueryBuilder: jest.fn(() => txAssignmentQb),
    save: jest.fn((a: unknown) => Promise.resolve(a)),
  };
  const txTransferLogRepo = { save: jest.fn() };

  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Table) return txTableRepo;
      if (entity === Order) return txOrderRepo;
      if (entity === TableAssignment) return txAssignmentRepo;
      if (entity === TableTransferLog) return txTransferLogRepo;
      return {};
    }),
  } as unknown as EntityManager;

  const dataSource = {
    transaction: jest.fn(
      (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
    ),
  };

  const realtime = {
    tableStatusChanged: jest.fn(),
    tableTransferred: jest.fn(),
    assignmentChanged: jest.fn(),
    floorPlanUpdated: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TablesService,
        { provide: getRepositoryToken(Table), useValue: tableRepo },
        { provide: getRepositoryToken(Merchant), useValue: merchantRepo },
        { provide: getRepositoryToken(FloorZone), useValue: floorZoneRepo },
        { provide: getRepositoryToken(FloorPlan), useValue: floorPlanRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        {
          provide: getRepositoryToken(TableAssignment),
          useValue: assignmentRepo,
        },
        {
          provide: getRepositoryToken(TableTransferLog),
          useValue: transferLogRepo,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: DiningRealtimePublisher, useValue: realtime },
      ],
    }).compile();

    service = module.get<TablesService>(TablesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // clearAllMocks vacía las llamadas pero NO las colas de mockResolvedValueOnce: sin este
    // reset, la secuencia que encola una prueba se la come la siguiente y los fallos
    // aparecen en tests que no tienen nada que ver.
    [
      tableRepo.findOne,
      tableRepo.find,
      tableRepo.save,
      txTableRepo.findOne,
      txTableRepo.find,
      txTableRepo.save,
      orderRepo.findOne,
      orderRepo.count,
      txOrderRepo.findOne,
      txOrderRepo.save,
      dataSource.transaction,
    ].forEach((m) => m.mockReset());

    tableRepo.find.mockResolvedValue([]);
    tableRepo.save.mockImplementation((t: unknown) => Promise.resolve(t));
    txTableRepo.save.mockImplementation((t: unknown) => Promise.resolve(t));
    txTableRepo.find.mockResolvedValue([]);
    orderRepo.count.mockResolvedValue(0);
    assignmentQb.getCount.mockResolvedValue(0);
    assignmentQb.getMany.mockResolvedValue([]);
    assignmentRepo.createQueryBuilder.mockReturnValue(assignmentQb);
    txAssignmentQb.getMany.mockResolvedValue([]);
    txAssignmentRepo.createQueryBuilder.mockReturnValue(txAssignmentQb);
    dataSource.transaction.mockImplementation(
      (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
    );
  });

  // ================= Traslado =================

  describe('transfer', () => {
    const source = makeTable({
      id: 4,
      number: 'A1',
      status: TableStatus.OCCUPIED,
    });
    const target = makeTable({
      id: 9,
      number: 'B3',
      status: TableStatus.AVAILABLE,
    });

    const primeTables = (src: Table, tgt: Table) => {
      txTableRepo.findOne
        .mockResolvedValueOnce(src)
        .mockResolvedValueOnce(tgt)
        // Tercera lectura: la mesa destino ya movida, para la respuesta.
        .mockResolvedValueOnce(tgt);
    };

    it('exige que origen y destino sean distintos', async () => {
      await expect(
        service.transfer(
          { sourceTableId: 4, targetTableId: 4 },
          MERCHANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un destino que no está disponible, con el mensaje de la historia', async () => {
      primeTables(source, makeTable({ id: 9, number: 'B3', status: TableStatus.OCCUPIED }));

      await expect(
        service.transfer(
          { sourceTableId: 4, targetTableId: 9 },
          MERCHANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(
        'Target Table [B3] is currently occupied or unavailable for transfer.',
      );
    });

    it('rechaza un destino en limpieza', async () => {
      primeTables(source, makeTable({ id: 9, number: 'B3', status: TableStatus.CLEANING }));

      await expect(
        service.transfer(
          { sourceTableId: 4, targetTableId: 9 },
          MERCHANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rechaza un origen sin comensales sentados', async () => {
      primeTables(
        makeTable({ id: 4, number: 'A1', status: TableStatus.AVAILABLE }),
        target,
      );

      await expect(
        service.transfer(
          { sourceTableId: 4, targetTableId: 9 },
          MERCHANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow('Table A1 has no seated party to transfer.');
    });

    it('no deja mover comensales a la sala de otro comercio', async () => {
      primeTables(
        source,
        makeTable({
          id: 9,
          number: 'B3',
          status: TableStatus.AVAILABLE,
          merchant_id: 99,
        }),
      );

      await expect(
        service.transfer(
          { sourceTableId: 4, targetTableId: 9 },
          MERCHANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('falla si el destino no existe', async () => {
      txTableRepo.findOne.mockResolvedValueOnce(source).mockResolvedValueOnce(null);

      await expect(
        service.transfer(
          { sourceTableId: 4, targetTableId: 9 },
          MERCHANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('re-vincula la comanda abierta, libera el origen y ocupa el destino', async () => {
      const src = makeTable({ id: 4, number: 'A1', status: TableStatus.OCCUPIED });
      const tgt = makeTable({ id: 9, number: 'B3', status: TableStatus.AVAILABLE });
      primeTables(src, tgt);
      txOrderRepo.findOne.mockResolvedValue({ id: 120, table_id: 4 });

      await service.transfer(
        { sourceTableId: 4, targetTableId: 9 },
        MERCHANT_ID,
        USER_ID,
      );

      // La comanda pasa a la mesa destino sin cerrarse.
      expect(txOrderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 120, table_id: 9 }),
      );
      expect(src.status).toBe(TableStatus.CLEANING);
      expect(tgt.status).toBe(TableStatus.OCCUPIED);
    });

    it('el camarero se lleva la mesa en vez de perder la cobertura', async () => {
      primeTables(
        makeTable({ id: 4, number: 'A1', status: TableStatus.OCCUPIED }),
        makeTable({ id: 9, number: 'B3', status: TableStatus.AVAILABLE }),
      );
      txOrderRepo.findOne.mockResolvedValue(null);
      txAssignmentQb.getMany.mockResolvedValue([
        { id: 55, tableId: 4, shiftId: 3, collaboratorId: 8, releasedAt: null },
      ]);

      await service.transfer(
        { sourceTableId: 4, targetTableId: 9 },
        MERCHANT_ID,
        USER_ID,
      );

      expect(txAssignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 55, tableId: 9 }),
      );
      expect(realtime.assignmentChanged).toHaveBeenCalledWith(
        expect.objectContaining({ assignmentId: 55, tableId: 9, action: 'reassigned' }),
      );
    });

    it('escribe el rastro de auditoría con quién, qué mesas y qué comanda', async () => {
      primeTables(
        makeTable({ id: 4, number: 'A1', status: TableStatus.OCCUPIED }),
        makeTable({ id: 9, number: 'B3', status: TableStatus.AVAILABLE }),
      );
      txOrderRepo.findOne.mockResolvedValue({ id: 120, table_id: 4 });

      await service.transfer(
        { sourceTableId: 4, targetTableId: 9 },
        MERCHANT_ID,
        USER_ID,
      );

      expect(txTransferLogRepo.save).toHaveBeenCalledWith({
        merchant_id: MERCHANT_ID,
        source_table_id: 4,
        target_table_id: 9,
        order_id: 120,
        user_id: USER_ID,
      });
    });

    it('una mesa marcada ocupada a mano se traslada igual, sin comanda que re-vincular', async () => {
      primeTables(
        makeTable({ id: 4, number: 'A1', status: TableStatus.OCCUPIED }),
        makeTable({ id: 9, number: 'B3', status: TableStatus.AVAILABLE }),
      );
      txOrderRepo.findOne.mockResolvedValue(null);

      await service.transfer(
        { sourceTableId: 4, targetTableId: 9 },
        MERCHANT_ID,
        USER_ID,
      );

      expect(txOrderRepo.save).not.toHaveBeenCalled();
      expect(txTransferLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ order_id: null }),
      );
    });

    it('anuncia el traslado y los dos estados a las tablets', async () => {
      primeTables(
        makeTable({ id: 4, number: 'A1', status: TableStatus.OCCUPIED }),
        makeTable({ id: 9, number: 'B3', status: TableStatus.AVAILABLE }),
      );
      txOrderRepo.findOne.mockResolvedValue({ id: 120, table_id: 4 });

      await service.transfer(
        { sourceTableId: 4, targetTableId: 9 },
        MERCHANT_ID,
        USER_ID,
      );

      expect(realtime.tableTransferred).toHaveBeenCalledWith({
        merchantId: MERCHANT_ID,
        sourceTableId: 4,
        targetTableId: 9,
        orderId: 120,
      });
      expect(realtime.tableStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({ tableId: 4, status: TableStatus.CLEANING }),
      );
      expect(realtime.tableStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({ tableId: 9, status: TableStatus.OCCUPIED }),
      );
    });

    it('no anuncia nada si la transacción se deshace', async () => {
      dataSource.transaction.mockRejectedValueOnce(new Error('rollback'));

      await expect(
        service.transfer(
          { sourceTableId: 4, targetTableId: 9 },
          MERCHANT_ID,
          USER_ID,
        ),
      ).rejects.toThrow('rollback');
      expect(realtime.tableTransferred).not.toHaveBeenCalled();
    });
  });

  // ================= Guarda de servicio vivo =================

  describe('remove · guarda de servicio vivo', () => {
    const busyTable = makeTable({
      id: 4,
      number: 'A1',
      status: TableStatus.OCCUPIED,
      childTables: [],
      floorZone: { id: 1 },
      floorPlan: { id: 1 },
    } as unknown as Partial<Table>);

    it('bloquea borrar una mesa ocupada con el mensaje de la historia', async () => {
      tableRepo.findOne.mockResolvedValue(busyTable);

      await expect(service.remove(4, MERCHANT_ID)).rejects.toThrow(
        'Cannot modify or remove Table A1 while it has an active guest order or assigned server. Please close open orders first.',
      );
      expect(tableRepo.save).not.toHaveBeenCalled();
    });

    it('bloquea borrar una mesa libre que aún tiene comanda abierta', async () => {
      tableRepo.findOne.mockResolvedValue(
        makeTable({
          id: 4,
          number: 'A1',
          status: TableStatus.AVAILABLE,
          childTables: [],
        } as unknown as Partial<Table>),
      );
      orderRepo.count.mockResolvedValue(1);

      await expect(service.remove(4, MERCHANT_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('bloquea borrar una mesa con camarero asignado', async () => {
      tableRepo.findOne.mockResolvedValue(
        makeTable({
          id: 4,
          number: 'A1',
          status: TableStatus.AVAILABLE,
          childTables: [],
        } as unknown as Partial<Table>),
      );
      assignmentQb.getCount.mockResolvedValue(1);

      await expect(service.remove(4, MERCHANT_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deja borrar una mesa libre y sin cobertura, y lo anuncia', async () => {
      const free = makeTable({
        id: 4,
        number: 'A1',
        status: TableStatus.AVAILABLE,
        childTables: [],
      } as unknown as Partial<Table>);
      tableRepo.findOne
        .mockResolvedValueOnce(free)
        .mockResolvedValueOnce({ ...free, status: 'deleted' });

      await service.remove(4, MERCHANT_ID);

      expect(realtime.tableStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({ tableId: 4, status: 'deleted' }),
      );
    });
  });

  describe('update · guarda de mudanza de sala', () => {
    const occupied = () =>
      makeTable({
        id: 4,
        number: 'A1',
        status: TableStatus.OCCUPIED,
        floorZone: { id: 1 },
        floorPlan: { id: 1 },
      } as unknown as Partial<Table>);

    it('bloquea mudar de zona una mesa en servicio', async () => {
      tableRepo.findOne.mockResolvedValue(occupied());

      await expect(
        service.update(4, { floorZone: 2 }, MERCHANT_ID),
      ).rejects.toThrow('Cannot modify or remove Table A1');
    });

    it('reenviar la MISMA zona no es una mudanza y no dispara la guarda', async () => {
      const table = occupied();
      tableRepo.findOne
        .mockResolvedValueOnce(table)
        .mockResolvedValueOnce(table);
      floorZoneRepo.findOne.mockResolvedValue({ id: 1, floorPlan: { id: 1 } });

      await expect(
        service.update(4, { floorZone: 1 }, MERCHANT_ID),
      ).resolves.toBeDefined();
    });

    it('recolocar la mesa en su propio lienzo sigue permitido con comensales', async () => {
      const table = occupied();
      tableRepo.findOne
        .mockResolvedValueOnce(table)
        .mockResolvedValueOnce(table);

      await expect(
        service.update(4, { pos_x: 300, pos_y: 200 }, MERCHANT_ID),
      ).resolves.toBeDefined();
    });
  });

  // ================= Grupo unido =================

  describe('grupo unido', () => {
    it('una madre que se ocupa arrastra a sus hijas', async () => {
      const parent = makeTable({
        id: 1,
        number: 'A1',
        status: TableStatus.AVAILABLE,
        floorZone: { id: 1 },
        floorPlan: { id: 1 },
      } as unknown as Partial<Table>);
      const updated = { ...parent, status: TableStatus.OCCUPIED } as Table;
      tableRepo.findOne
        .mockResolvedValueOnce(parent)
        .mockResolvedValueOnce(updated);
      const child = makeTable({
        id: 2,
        number: 'A2',
        status: TableStatus.AVAILABLE,
        parent_table_id: 1,
      });
      tableRepo.find.mockResolvedValue([child]);

      await service.update(1, { status: TableStatus.OCCUPIED }, MERCHANT_ID);

      expect(child.status).toBe(TableStatus.OCCUPIED);
      expect(realtime.tableStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({ tableId: 2, status: TableStatus.OCCUPIED }),
      );
    });

    it('una madre que se libera NO arrastra a nadie: de eso se encarga el cierre de cuenta', async () => {
      const parent = makeTable({
        id: 1,
        number: 'A1',
        status: TableStatus.OCCUPIED,
        floorZone: { id: 1 },
        floorPlan: { id: 1 },
      } as unknown as Partial<Table>);
      tableRepo.findOne
        .mockResolvedValueOnce(parent)
        .mockResolvedValueOnce({ ...parent, status: TableStatus.AVAILABLE });

      await service.update(1, { status: TableStatus.AVAILABLE }, MERCHANT_ID);

      expect(tableRepo.find).not.toHaveBeenCalled();
    });

    it('al saldar la cuenta suelta a las hijas y manda el grupo a limpieza', async () => {
      const parent = makeTable({
        id: 1,
        number: 'A1',
        status: TableStatus.OCCUPIED,
      });
      const child = makeTable({
        id: 2,
        number: 'A2',
        status: TableStatus.OCCUPIED,
        parent_table_id: 1,
      });
      tableRepo.findOne.mockResolvedValue(parent);
      tableRepo.find.mockResolvedValue([child]);

      await service.releaseJoinedGroup(1);

      expect(child.parentTable).toBeNull();
      expect(child.status).toBe(TableStatus.CLEANING);
      expect(parent.status).toBe(TableStatus.CLEANING);
      expect(realtime.tableStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({ tableId: 2, parent_table_id: null }),
      );
    });

    it('no toca una mesa ya borrada', async () => {
      tableRepo.findOne.mockResolvedValue(
        makeTable({ id: 1, status: 'deleted' }),
      );

      await service.releaseJoinedGroup(1);

      expect(tableRepo.save).not.toHaveBeenCalled();
    });
  });

  // ================= Delta de reconciliación =================

  describe('statusDelta', () => {
    it('pide sólo las mesas tocadas después del instante dado', async () => {
      tableRepo.find.mockResolvedValue([]);

      await service.statusDelta(
        { since: '2026-08-19T10:00:00.000Z' },
        MERCHANT_ID,
      );

      const call = tableRepo.find.mock.calls[0][0] as {
        where: { merchant_id: number; updated_at?: unknown };
      };
      expect(call.where.merchant_id).toBe(MERCHANT_ID);
      expect(call.where.updated_at).toBeDefined();
    });

    it('sin `since` devuelve la sala entera, que es lo que necesita un terminal recién arrancado', async () => {
      tableRepo.find.mockResolvedValue([]);

      await service.statusDelta({}, MERCHANT_ID);

      const call = tableRepo.find.mock.calls[0][0] as {
        where: { updated_at?: unknown };
      };
      expect(call.where.updated_at).toBeUndefined();
    });

    it('incluye las borradas para que el cliente pueda quitarlas del plano', async () => {
      tableRepo.find.mockResolvedValue([
        makeTable({ id: 4, number: 'A1', status: 'deleted' }),
      ]);

      const res = await service.statusDelta({}, MERCHANT_ID);

      expect(res.data).toHaveLength(1);
      expect(res.data[0].status).toBe('deleted');
    });

    it('rechaza un instante ilegible', async () => {
      await expect(
        service.statusDelta({ since: 'ayer por la tarde' }, MERCHANT_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('exige comercio autenticado', async () => {
      await expect(
        service.statusDelta({}, undefined as unknown as number),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
