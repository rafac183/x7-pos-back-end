/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CollaboratorsService } from './collaborators.service';
import { Collaborator } from './entities/collaborator.entity';
import { User } from 'src/platform-saas/users/entities/user.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Shift } from 'src/restaurant-operations/shift/shifts/entities/shift.entity';
import { ShiftAssignment } from 'src/restaurant-operations/shift/shift-assignments/entities/shift-assignment.entity';
import { TableAssignment } from 'src/restaurant-operations/dining-system/table-assignments/entities/table-assignment.entity';
import { CashDrawer } from 'src/restaurant-operations/cashdrawer/cash-drawers/entities/cash-drawer.entity';
import { Order } from 'src/restaurant-operations/pos/orders/entities/order.entity';
import { ShiftRole } from './constants/shift-role.enum';
import { CollaboratorStatus } from './constants/collaborator-status.enum';

/**
 * Lo que estas historias añadieron al módulo: enganche a un turno recurrente, respuesta
 * con los datos que el directorio necesita (email, turno, alta) y resumen operativo.
 */
describe('CollaboratorsService · HR directory', () => {
  let service: CollaboratorsService;

  const MERCHANT_ID = 3;

  const merchant = { id: MERCHANT_ID, name: 'Prueba1' };
  const user = { id: 9, username: 'jperez', email: 'juan@store.com' };

  const collaborator = {
    id: 4,
    user_id: 9,
    merchant_id: MERCHANT_ID,
    name: 'Juan (sala)',
    role: ShiftRole.WAITER,
    status: CollaboratorStatus.ACTIVE,
    employeeId: null,
    department: null,
    created_at: new Date('2026-08-24T10:00:00Z'),
    shift_id: null,
    shift: null,
    merchant,
    user,
  } as unknown as Collaborator;

  const collaboratorRepo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn((v: unknown) => Promise.resolve({ id: 4, ...(v as object) })),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const userRepo = { findOne: jest.fn() };
  const merchantRepo = { findOne: jest.fn() };
  const shiftRepo = { findOne: jest.fn() };
  const shiftAssignmentRepo = { count: jest.fn(), find: jest.fn() };
  const tableAssignmentRepo = { count: jest.fn(), find: jest.fn() };
  const cashDrawerRepo = { count: jest.fn(), find: jest.fn() };
  const orderQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };
  const orderRepo = {
    count: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => orderQb),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaboratorsService,
        { provide: getRepositoryToken(Collaborator), useValue: collaboratorRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Merchant), useValue: merchantRepo },
        { provide: getRepositoryToken(Shift), useValue: shiftRepo },
        { provide: getRepositoryToken(ShiftAssignment), useValue: shiftAssignmentRepo },
        { provide: getRepositoryToken(TableAssignment), useValue: tableAssignmentRepo },
        { provide: getRepositoryToken(CashDrawer), useValue: cashDrawerRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: EntityManager, useValue: {} },
      ],
    }).compile();

    service = module.get<CollaboratorsService>(CollaboratorsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    [
      collaboratorRepo.findOne,
      userRepo.findOne,
      merchantRepo.findOne,
      shiftRepo.findOne,
      shiftAssignmentRepo.count,
      shiftAssignmentRepo.find,
      tableAssignmentRepo.count,
      tableAssignmentRepo.find,
      cashDrawerRepo.count,
      cashDrawerRepo.find,
      orderRepo.count,
      orderRepo.find,
      orderQb.getRawOne,
    ].forEach((m) => m.mockReset());
    collaboratorRepo.create.mockImplementation((v: unknown) => v);
    collaboratorRepo.save.mockImplementation((v: unknown) =>
      Promise.resolve({ id: 4, ...(v as object) }),
    );
    orderRepo.createQueryBuilder.mockReturnValue(orderQb);
    orderQb.select.mockReturnThis();
    orderQb.where.mockReturnThis();
  });

  // ================= Enganche al turno =================

  describe('shift binding', () => {
    const createDto = {
      user_id: 9,
      merchant_id: MERCHANT_ID,
      name: 'Juan (sala)',
      role: ShiftRole.WAITER,
      status: CollaboratorStatus.ACTIVE,
    };

    const primeCreate = () => {
      userRepo.findOne.mockResolvedValue(user);
      merchantRepo.findOne.mockResolvedValue(merchant);
      collaboratorRepo.findOne.mockResolvedValue(null);
    };

    it('deja el turno vacío cuando no se manda ninguno', async () => {
      primeCreate();

      const res = await service.create(createDto, MERCHANT_ID);

      expect(res.data.shift_id).toBeNull();
      expect(res.data.shift).toBeNull();
      expect(shiftRepo.findOne).not.toHaveBeenCalled();
    });

    it('engancha el colaborador a un turno de su propio comercio', async () => {
      primeCreate();
      shiftRepo.findOne.mockResolvedValue({
        id: 7,
        merchantId: MERCHANT_ID,
        role: 'waiter',
        startTime: new Date('2026-08-24T11:00:00Z'),
        endTime: null,
        status: 'active',
      });

      const res = await service.create({ ...createDto, shift_id: 7 }, MERCHANT_ID);

      expect(res.data.shift_id).toBe(7);
      expect(res.data.shift).toMatchObject({ id: 7, role: 'waiter' });
    });

    it('rechaza un turno de otro comercio', async () => {
      primeCreate();
      shiftRepo.findOne.mockResolvedValue({ id: 7, merchantId: 99 });

      await expect(
        service.create({ ...createDto, shift_id: 7 }, MERCHANT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rechaza un turno inexistente', async () => {
      primeCreate();
      shiftRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({ ...createDto, shift_id: 7 }, MERCHANT_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ================= Respuesta del directorio =================

  describe('response shape', () => {
    it('expone el email con su nombre real, sin dejar de servir el mapeo antiguo', async () => {
      userRepo.findOne.mockResolvedValue(user);
      merchantRepo.findOne.mockResolvedValue(merchant);
      collaboratorRepo.findOne.mockResolvedValue(null);

      const res = await service.create(
        {
          user_id: 9,
          merchant_id: MERCHANT_ID,
          name: 'Juan (sala)',
          role: ShiftRole.WAITER,
          status: CollaboratorStatus.ACTIVE,
        },
        MERCHANT_ID,
      );

      expect(res.data.user.email).toBe('juan@store.com');
      expect(res.data.user.username).toBe('jperez');
      // El contrato viejo metía el correo en `lastname`: se conserva para no romper clientes.
      expect(res.data.user.lastname).toBe('juan@store.com');
    });
  });

  // ================= Resumen operativo =================

  describe('summary', () => {
    const primeSummary = () => {
      collaboratorRepo.findOne.mockResolvedValue(collaborator);
      shiftAssignmentRepo.count.mockResolvedValue(12);
      tableAssignmentRepo.count.mockResolvedValue(4);
      // Dos llamadas: cajas abiertas y cajas cerradas.
      cashDrawerRepo.count.mockResolvedValueOnce(7).mockResolvedValueOnce(6);
      orderRepo.count.mockResolvedValue(143);
      shiftAssignmentRepo.find.mockResolvedValue([]);
      tableAssignmentRepo.find.mockResolvedValue([]);
      cashDrawerRepo.find.mockResolvedValue([]);
      orderRepo.find.mockResolvedValue([]);
      orderQb.getRawOne.mockResolvedValue({ sum: '15420.50' });
    };

    it('cuenta cada relación operativa del colaborador', async () => {
      primeSummary();

      const res = await service.summary(4, MERCHANT_ID);

      expect(res.data.counts).toEqual({
        shiftAssignments: 12,
        tableAssignments: 4,
        openedCashDrawers: 7,
        closedCashDrawers: 6,
        orders: 143,
      });
    });

    it('suma el volumen de ventas en la base, no en memoria', async () => {
      primeSummary();

      const res = await service.summary(4, MERCHANT_ID);

      expect(res.data.ordersTotal).toBe(15420.5);
      expect(orderQb.select).toHaveBeenCalledWith(
        'COALESCE(SUM(order.total), 0)',
        'sum',
      );
    });

    it('devuelve cero cuando el colaborador no ha tomado ninguna comanda', async () => {
      primeSummary();
      orderQb.getRawOne.mockResolvedValue(undefined);

      const res = await service.summary(4, MERCHANT_ID);

      expect(res.data.ordersTotal).toBe(0);
    });

    it('resume la mesa con su número y su zona', async () => {
      primeSummary();
      tableAssignmentRepo.find.mockResolvedValue([
        {
          id: 55,
          tableId: 10,
          assignedAt: new Date('2026-08-24T12:30:00Z'),
          releasedAt: null,
          table: { number: 'A1', floorZone: { name: 'VIP Lounge' } },
        },
      ]);

      const res = await service.summary(4, MERCHANT_ID);

      expect(res.data.recentTableAssignments[0]).toMatchObject({
        tableNumber: 'A1',
        zoneName: 'VIP Lounge',
      });
    });

    it('no enseña el resumen de un empleado de otro comercio', async () => {
      collaboratorRepo.findOne.mockResolvedValue({
        ...collaborator,
        merchant_id: 99,
      });

      await expect(service.summary(4, MERCHANT_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('falla si el colaborador no existe', async () => {
      collaboratorRepo.findOne.mockResolvedValue(null);

      await expect(service.summary(404, MERCHANT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rechaza un id inválido', async () => {
      await expect(service.summary(0, MERCHANT_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('exige comercio autenticado', async () => {
      await expect(
        service.summary(4, undefined as unknown as number),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
