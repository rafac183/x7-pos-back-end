import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CashShiftsService } from './cash-shifts.service';
import { CashShift } from './entities/cash-shift.entity';
import { CashShiftStatus } from './constants/cash-shift-status.enum';
import { CashDrawer } from '../cash-drawers/entities/cash-drawer.entity';
import { CashDrawerStatus } from '../cash-drawers/constants/cash-drawer-status.enum';
import { Merchant } from '../../../platform-saas/merchants/entities/merchant.entity';
import { Collaborator } from '../../../finance-hr/hr/collaborators/entities/collaborator.entity';
import { CashShiftRepository } from './cash-shift.repository';
import { CashFlowService } from './cash-flow.service';
import { CreateCashShiftDto } from './dto/create-cash-shift.dto';
import { CloseCashShiftDto } from './dto/close-cash-shift.dto';
import { ManualCashTransactionDto } from './dto/manual-cash-transaction.dto';
import { CashShiftMovementType } from './constants/cash-shift-movement-type.enum';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../platform-saas/users/constants/role.enum';
import { Scope } from '../../../platform-saas/users/constants/scope.enum';

describe('CashShiftsService', () => {
  let service: CashShiftsService;
  let cashDrawerRepo: Repository<CashDrawer>;
  let collaboratorRepo: Repository<Collaborator>;
  let cashShiftRepo: CashShiftRepository;
  let cashFlowService: CashFlowService;

  const mockCashDrawerRepository = {
    findOne: jest.fn(),
  };

  const mockMerchantRepository = {
    findOne: jest.fn(),
  };

  const mockCollaboratorRepository = {
    findOne: jest.fn(),
  };

  const mockCashShiftRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    getLiveBalance: jest.fn(),
    getSalesSummary: jest.fn(),
  };

  const mockCashFlowService = {
    addMovement: jest.fn(),
  };

  const mockEntityManager = {
    findOne: jest.fn(),
    query: jest.fn(),
    getRepository: jest.fn().mockReturnThis(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: mockEntityManager,
  };

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  };

  // Collaborator linked to the currently authenticated user (activeUser below).
  const mockCollaborator = {
    id: 5,
    user_id: 1,
    merchant_id: 10,
    name: 'John Doe',
    role: 'WAITER',
  };

  // A different collaborator, used for "someone else opened/closes this shift" cases.
  const mockOtherCollaborator = {
    id: 8,
    user_id: 2,
    merchant_id: 10,
    name: 'Mark Lee',
    role: 'MANAGER',
  };

  const activeUser: AuthenticatedUser = {
    id: 1,
    email: 'cashier@test.com',
    role: UserRole.MERCHANT_USER,
    scope: Scope.MERCHANT_WEB,
    merchant: { id: 10 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashShiftsService,
        {
          provide: getRepositoryToken(CashDrawer),
          useValue: mockCashDrawerRepository,
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: mockMerchantRepository,
        },
        {
          provide: getRepositoryToken(Collaborator),
          useValue: mockCollaboratorRepository,
        },
        {
          provide: CashShiftRepository,
          useValue: mockCashShiftRepository,
        },
        {
          provide: CashFlowService,
          useValue: mockCashFlowService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CashShiftsService>(CashShiftsService);
    cashDrawerRepo = module.get<Repository<CashDrawer>>(
      getRepositoryToken(CashDrawer),
    );
    collaboratorRepo = module.get<Repository<Collaborator>>(
      getRepositoryToken(Collaborator),
    );
    cashShiftRepo = module.get<CashShiftRepository>(CashShiftRepository);
    cashFlowService = module.get<CashFlowService>(CashFlowService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('openShift', () => {
    const createDto: CreateCashShiftDto = {
      cashDrawerId: 1,
      openingBalance: 100,
    };

    it('should resolve the collaborator from the JWT and open a shift successfully', async () => {
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest.spyOn(cashDrawerRepo, 'findOne').mockResolvedValue({
        id: 1,
        merchant_id: 10,
        status: CashDrawerStatus.OPEN,
      } as any);
      const savedShift = {
        id: 99,
        merchantId: 10,
        cashDrawerId: 1,
        openedBy: 5,
        closedBy: null,
        openingBalance: 100,
        systemAmount: null,
        declaredAmount: null,
        difference: null,
        status: CashShiftStatus.OPEN,
        openedAt: new Date(),
        closedAt: null,
      };
      jest.spyOn(cashShiftRepo, 'create').mockReturnValue(savedShift as any);
      jest.spyOn(cashShiftRepo, 'save').mockResolvedValue(savedShift as any);
      // Exactly 3 queued values for the 3 real cashShiftRepo.findOne calls this
      // path makes, in order: the per-collaborator guard, the per-drawer guard,
      // and the post-save refetch-with-relations.
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValueOnce(null) // collaborator guard
        .mockResolvedValueOnce(null) // drawer guard
        .mockResolvedValueOnce({
          ...savedShift,
          openedByCollaborator: mockCollaborator,
          closedByCollaborator: null,
        } as any); // post-save refetch with relations

      const result = await service.openShift(createDto, activeUser);

      expect(collaboratorRepo.findOne).toHaveBeenCalledWith({
        where: { user_id: 1, merchant_id: 10 },
      });
      expect(cashShiftRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ openedBy: 5, cashDrawerId: 1, openingBalance: 100 }),
      );
      expect(result.statusCode).toBe(201);
      expect(result.message).toBe('Cash shift opened successfully');
      expect(result.data.id).toBe(99);
      expect(result.data.status).toBe(CashShiftStatus.OPEN);
      expect(result.data.openedByCollaborator).toEqual({
        id: 5,
        name: 'John Doe',
        role: 'WAITER',
      });
      expect(result.data.closedByCollaborator).toBeNull();
    });

    it('should throw ForbiddenException when the user has no merchant', async () => {
      const userWithoutMerchant = { ...activeUser, merchant: undefined as any };
      await expect(
        service.openShift(createDto, userWithoutMerchant),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when the user has no linked collaborator profile', async () => {
      jest.spyOn(collaboratorRepo, 'findOne').mockResolvedValue(null);

      await expect(service.openShift(createDto, activeUser)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.openShift(createDto, activeUser)).rejects.toThrow(
        'Your user account is not linked to any collaborator record. Cannot open cash shift.',
      );
    });

    it('should allow opening shift even when collaborator already has an active shift elsewhere', async () => {
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashDrawerRepo, 'findOne')
        .mockResolvedValue({ id: 1, merchant_id: 10, status: CashDrawerStatus.OPEN } as any);
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 99, status: CashShiftStatus.OPEN, openedByCollaborator: mockCollaborator } as any);

      const result = await service.openShift(createDto, activeUser);
      expect(result.statusCode).toBe(201);
    });

    it('should throw ConflictException naming the active session id when the drawer already has an open shift', async () => {
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValueOnce(null) // collaborator guard
        .mockResolvedValueOnce({ id: 42, status: CashShiftStatus.OPEN } as any); // drawer guard

      // A single invocation, inspected once: two separate `await expect(...)`
      // calls would each re-invoke openShift and exhaust the two queued
      // `mockResolvedValueOnce` values between them, so the second call
      // would fall through to `cashDrawerRepo.findOne` (unmocked here) and
      // throw a different exception than the one under test.
      const error: unknown = await service
        .openShift(createDto, activeUser)
        .catch((e) => e);

      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toBe(
        'Cash Drawer #1 already has an active shift session (#CS-42) in progress. Please close the active shift before opening a new one.',
      );
    });
  });

  describe('closeShift', () => {
    const closeDto: CloseCashShiftDto = {
      declaredAmount: 120,
    };

    const activeShift = {
      id: 99,
      merchantId: 10,
      cashDrawerId: 1,
      openedBy: 5,
      openingBalance: 100,
      status: CashShiftStatus.OPEN,
      openedAt: new Date(),
    };

    it('should resolve closedBy from the JWT and close a shift, calculating the difference', async () => {
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValueOnce({ ...activeShift } as any)
        .mockResolvedValueOnce({
          ...activeShift,
          status: CashShiftStatus.CLOSED,
          systemAmount: 120,
          declaredAmount: 120,
          difference: 0,
          closedBy: 5,
          closedAt: new Date(),
          openedByCollaborator: mockCollaborator,
          closedByCollaborator: mockCollaborator,
        } as any);
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest.spyOn(cashShiftRepo, 'getLiveBalance').mockResolvedValue(120);
      jest
        .spyOn(cashShiftRepo, 'save')
        .mockImplementation(async (s) => s as any);
      jest
        .spyOn(cashShiftRepo, 'getSalesSummary')
        .mockResolvedValue([{ method: 'Cash', amount: 20 }]);

      const result = await service.closeShift(99, closeDto, activeUser);

      expect(collaboratorRepo.findOne).toHaveBeenCalledWith({
        where: { user_id: 1, merchant_id: 10 },
      });
      expect(cashShiftRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ closedBy: 5, status: CashShiftStatus.CLOSED }),
      );
      expect(result.statusCode).toBe(200);
      expect(result.data.systemAmount).toBe(120);
      expect(result.data.declaredAmount).toBe(120);
      expect(result.data.difference).toBe(0);
      expect(result.data.status).toBe(CashShiftStatus.CLOSED);
    });

    it('should set status to DISCREPANCY when declaredAmount does not match systemAmount, rounded to cents', async () => {
      // declaredAmount 119.999 rounds to 120.00; getLiveBalance below returns
      // 100, so systemAmount rounds to 100.00 — a genuine 20.00 overage, not
      // sub-cent noise, so this must land on DISCREPANCY.
      const mismatchedDto: CloseCashShiftDto = { declaredAmount: 119.999 };
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValueOnce({ ...activeShift } as any)
        .mockResolvedValueOnce({
          ...activeShift,
          status: CashShiftStatus.DISCREPANCY,
          systemAmount: 100,
          declaredAmount: 120,
          difference: 20,
          closedBy: 5,
          openedByCollaborator: mockCollaborator,
          closedByCollaborator: mockCollaborator,
        } as any);
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest.spyOn(cashShiftRepo, 'getLiveBalance').mockResolvedValue(100);
      jest
        .spyOn(cashShiftRepo, 'save')
        .mockImplementation(async (s) => s as any);
      jest.spyOn(cashShiftRepo, 'getSalesSummary').mockResolvedValue([]);

      const result = await service.closeShift(99, mismatchedDto, activeUser);

      expect(cashShiftRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CashShiftStatus.DISCREPANCY }),
      );
    });

    it('should set status to CLOSED (not DISCREPANCY) when the difference is only sub-cent noise', async () => {
      const nearMatchDto: CloseCashShiftDto = { declaredAmount: 100.001 };
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValueOnce({ ...activeShift } as any)
        .mockResolvedValueOnce({
          ...activeShift,
          status: CashShiftStatus.CLOSED,
          openedByCollaborator: mockCollaborator,
          closedByCollaborator: mockCollaborator,
        } as any);
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest.spyOn(cashShiftRepo, 'getLiveBalance').mockResolvedValue(100);
      jest
        .spyOn(cashShiftRepo, 'save')
        .mockImplementation(async (s) => s as any);
      jest.spyOn(cashShiftRepo, 'getSalesSummary').mockResolvedValue([]);

      await service.closeShift(99, nearMatchDto, activeUser);

      expect(cashShiftRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: CashShiftStatus.CLOSED }),
      );
    });

    it('should not throw and should fall back to a placeholder when openedByCollaborator resolves to null (orphaned FK)', async () => {
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValueOnce({ ...activeShift } as any)
        .mockResolvedValueOnce({
          ...activeShift,
          status: CashShiftStatus.CLOSED,
          systemAmount: 120,
          declaredAmount: 120,
          difference: 0,
          closedBy: 5,
          closedAt: new Date(),
          openedByCollaborator: null, // simulates a deleted/missing collaborator row
          closedByCollaborator: mockCollaborator,
        } as any);
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest.spyOn(cashShiftRepo, 'getLiveBalance').mockResolvedValue(120);
      jest
        .spyOn(cashShiftRepo, 'save')
        .mockImplementation(async (s) => s as any);
      jest
        .spyOn(cashShiftRepo, 'getSalesSummary')
        .mockResolvedValue([{ method: 'Cash', amount: 20 }]);

      const result = await service.closeShift(99, closeDto, activeUser);

      expect(result.statusCode).toBe(200);
      expect(result.data.openedByCollaborator).toEqual({
        id: activeShift.openedBy,
        name: 'Unknown',
        role: '—',
      });
    });

    it('should throw ForbiddenException if MERCHANT_USER tries to close a shift opened by someone else', async () => {
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValue({ ...activeShift, openedBy: 8 } as any);
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue(mockCollaborator as any); // Current user resolves to collaborator 5

      await expect(
        service.closeShift(99, closeDto, activeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow MERCHANT_ADMIN to close a shift opened by someone else', async () => {
      const adminUser = { ...activeUser, role: UserRole.MERCHANT_ADMIN };
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValueOnce({ ...activeShift, openedBy: 8 } as any)
        .mockResolvedValueOnce({
          ...activeShift,
          openedBy: 8,
          status: CashShiftStatus.CLOSED,
          systemAmount: 100,
          declaredAmount: 150,
          difference: 50,
          closedBy: 5,
          openedByCollaborator: mockOtherCollaborator,
          closedByCollaborator: mockCollaborator,
        } as any);
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest.spyOn(cashShiftRepo, 'getLiveBalance').mockResolvedValue(100);
      jest
        .spyOn(cashShiftRepo, 'save')
        .mockImplementation(async (s) => s as any);
      jest.spyOn(cashShiftRepo, 'getSalesSummary').mockResolvedValue([]);

      const result = await service.closeShift(99, closeDto, adminUser);

      expect(result.statusCode).toBe(200);
      expect(result.data.closedByCollaborator?.id).toBe(5);
    });

    it('should throw ForbiddenException when the closing user has no linked collaborator profile', async () => {
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValue({ ...activeShift } as any);
      jest.spyOn(collaboratorRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.closeShift(99, closeDto, activeUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if the shift is not OPEN', async () => {
      jest.spyOn(cashShiftRepo, 'findOne').mockResolvedValue({
        ...activeShift,
        status: CashShiftStatus.CLOSED,
      } as any);

      await expect(
        service.closeShift(99, closeDto, activeUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addManualTransaction', () => {
    const manualDto: ManualCashTransactionDto = {
      amount: 50,
      type: CashShiftMovementType.OUT,
      collaboratorId: 5,
      reason: 'Payment to supplier',
    };

    const activeShift = {
      id: 99,
      merchantId: 10,
      cashDrawerId: 1,
      openedBy: 5,
      openingBalance: 100,
      status: CashShiftStatus.OPEN,
    };

    it('should register an OUT flow successfully if balance is sufficient', async () => {
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValue(activeShift as any);
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue({ id: 5, merchant_id: 10 } as any);

      mockEntityManager.findOne.mockResolvedValue(activeShift);
      mockEntityManager.query.mockResolvedValue([{ balance: '120' }]);
      jest
        .spyOn(cashFlowService, 'addMovement')
        .mockResolvedValue({ id: 1, amount: 50, type: 'withdrawal' } as any);

      const result = await service.addManualTransaction(99, manualDto, 10);

      expect(result.statusCode).toBe(201);
      expect(result.message).toBe('Manual transaction registered successfully');
      expect(result.data.amount).toBe(50);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for OUT flow if balance is insufficient (CAT 1)', async () => {
      jest
        .spyOn(cashShiftRepo, 'findOne')
        .mockResolvedValue(activeShift as any);
      jest
        .spyOn(collaboratorRepo, 'findOne')
        .mockResolvedValue({ id: 5, merchant_id: 10 } as any);

      mockEntityManager.findOne.mockResolvedValue(activeShift);
      mockEntityManager.query.mockResolvedValue([{ balance: '30' }]);

      await expect(
        service.addManualTransaction(99, manualDto, 10),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if trying to write on a CLOSED shift', async () => {
      jest.spyOn(cashShiftRepo, 'findOne').mockResolvedValue({
        ...activeShift,
        status: CashShiftStatus.CLOSED,
      } as any);

      await expect(
        service.addManualTransaction(99, manualDto, 10),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
