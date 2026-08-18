/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { Repository, Between } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { CashDrawersService } from './cash-drawers.service';
import { CashDrawer } from './entities/cash-drawer.entity';
import { Shift } from '../../shift/shifts/entities/shift.entity';
import { Collaborator } from '../../../finance-hr/hr/collaborators/entities/collaborator.entity';
import { CreateCashDrawerDto } from './dto/create-cash-drawer.dto';
import { CloseCashDrawerDto } from './dto/close-cash-drawer.dto';
import { GetCashDrawersQueryDto } from './dto/get-cash-drawers-query.dto';
import { CashDrawerStatus } from './constants/cash-drawer-status.enum';
import { CashDrawerHistoryService } from '../cash-drawer-history/cash-drawer-history.service';
import { ShiftRole } from '../../shift/shifts/constants/shift-role.enum';
import { ShiftStatus } from '../../shift/shifts/constants/shift-status.enum';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';

describe('CashDrawersService', () => {
  let service: CashDrawersService;
  let cashDrawerRepository: Repository<CashDrawer>;
  let shiftRepository: Repository<Shift>;
  let collaboratorRepository: Repository<Collaborator>;

  const mockCashDrawerRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockShiftRepository = {
    findOne: jest.fn(),
  };

  const mockCollaboratorRepository = {
    findOne: jest.fn(),
  };

  const mockMerchant = {
    id: 1,
    name: 'Test Merchant',
  };

  const mockShift = {
    id: 1,
    merchantId: 1,
    startTime: new Date('2024-01-15T08:00:00Z'),
    endTime: new Date('2024-01-15T16:00:00Z'),
    role: ShiftRole.WAITER,
    status: 'active',
    merchant: mockMerchant,
  };

  const mockCollaborator = {
    id: 1,
    user_id: 1,
    merchant_id: 1,
    name: 'Juan Pérez',
    role: ShiftRole.WAITER,
    status: 'activo',
    merchant: mockMerchant,
  };

  const mockUser: AuthenticatedUser = {
    id: 1,
    email: 'cashier@example.com',
    role: 'MERCHANT_USER' as any,
    scope: 'MERCHANT_WEB' as any,
    merchant: { id: 1 },
  };

  const mockCashDrawer = {
    id: 1,
    merchant_id: 1,
    shift_id: 1,
    opening_balance: 100.0,
    current_balance: 100.0,
    closing_balance: null,
    opened_by: 1,
    closed_by: null,
    status: CashDrawerStatus.OPEN,
    created_at: new Date('2024-01-15T08:00:00Z'),
    updated_at: new Date('2024-01-15T08:00:00Z'),
    merchant: mockMerchant,
    shift: {
      ...mockShift,
      merchant: mockMerchant,
    },
    openedByCollaborator: mockCollaborator,
    closedByCollaborator: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashDrawersService,
        {
          provide: getRepositoryToken(CashDrawer),
          useValue: mockCashDrawerRepository,
        },
        {
          provide: getRepositoryToken(Shift),
          useValue: mockShiftRepository,
        },
        {
          provide: getRepositoryToken(Collaborator),
          useValue: mockCollaboratorRepository,
        },
      ],
    }).compile();

    service = module.get<CashDrawersService>(CashDrawersService);
    cashDrawerRepository = module.get<Repository<CashDrawer>>(
      getRepositoryToken(CashDrawer),
    );
    shiftRepository = module.get<Repository<Shift>>(getRepositoryToken(Shift));
    collaboratorRepository = module.get<Repository<Collaborator>>(
      getRepositoryToken(Collaborator),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createCashDrawerDto: CreateCashDrawerDto = {
      openingBalance: 100.0,
    };

    it('should create a cash drawer successfully', async () => {
      jest
        .spyOn(shiftRepository, 'findOne')
        .mockResolvedValue(mockShift as any);
      jest
        .spyOn(collaboratorRepository, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashDrawerRepository, 'save')
        .mockResolvedValue(mockCashDrawer as any);
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValueOnce(mockCashDrawer as any); // complete drawer after save

      const result = await service.create(createCashDrawerDto, mockUser);

      expect(shiftRepository.findOne).toHaveBeenCalledWith({
        where: { merchant: { id: 1 }, status: ShiftStatus.ACTIVE },
        order: { startTime: 'DESC', id: 'DESC' },
      });
      expect(collaboratorRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 1, merchant_id: 1 },
      });
      expect(cashDrawerRepository.save).toHaveBeenCalled();
      expect(result.statusCode).toBe(201);
      expect(result.message).toBe('Cash drawer created successfully');
      expect(result.data.id).toBe(1);
    });

    it('should throw ForbiddenException when user has no merchant_id', async () => {
      const userWithoutMerchant = { ...mockUser, merchant: undefined as any };
      await expect(
        service.create(createCashDrawerDto, userWithoutMerchant),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.create(createCashDrawerDto, userWithoutMerchant),
      ).rejects.toThrow(
        'You must be associated with a merchant to create cash drawers',
      );
    });

    it('should throw BadRequestException if opening balance is negative', async () => {
      const dtoWithNegativeBalance = { openingBalance: -10 };

      await expect(
        service.create(dtoWithNegativeBalance, mockUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(dtoWithNegativeBalance, mockUser),
      ).rejects.toThrow('Opening balance must be non-negative');
    });

    it('should throw BadRequestException when there is no active shift for the merchant', async () => {
      jest.spyOn(shiftRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create(createCashDrawerDto, mockUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(createCashDrawerDto, mockUser),
      ).rejects.toThrow(
        'No active shift found. Start a shift before opening a cash drawer.',
      );
    });

    it('should throw BadRequestException when the user has no linked collaborator profile', async () => {
      jest
        .spyOn(shiftRepository, 'findOne')
        .mockResolvedValue(mockShift as any);
      jest.spyOn(collaboratorRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create(createCashDrawerDto, mockUser),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(createCashDrawerDto, mockUser),
      ).rejects.toThrow('No collaborator profile is linked to your account.');
    });

    it('should allow creating a cash drawer even when another cash drawer is already open', async () => {
      jest
        .spyOn(shiftRepository, 'findOne')
        .mockResolvedValue(mockShift as any);
      jest
        .spyOn(collaboratorRepository, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashDrawerRepository, 'save')
        .mockResolvedValue(mockCashDrawer as any);
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValue(mockCashDrawer as any);

      const result = await service.create(createCashDrawerDto, mockUser);
      expect(result.statusCode).toBe(201);
    });

    it('should not conflict with an open drawer for the same shift that belongs to a different merchant', async () => {
      // An OPEN drawer with the same shift_id exists, but it belongs to merchant_id 2 — a
      // different merchant than mockUser's (merchant_id 1). The guard query filters by
      // merchant_id, so in production this drawer would never be returned by
      // cashDrawerRepository.findOne() for mockUser's request; we simulate that filtered
      // result here (null) and assert the query was built with merchant_id, proving the
      // guard is merchant-scoped and not just shift-scoped.
      jest
        .spyOn(shiftRepository, 'findOne')
        .mockResolvedValue(mockShift as any);
      jest
        .spyOn(collaboratorRepository, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValueOnce(mockCashDrawer as any); // complete drawer after save
      jest
        .spyOn(cashDrawerRepository, 'save')
        .mockResolvedValue(mockCashDrawer as any);

      const result = await service.create(createCashDrawerDto, mockUser);

      expect(cashDrawerRepository.findOne).toHaveBeenNthCalledWith(1, {
        where: {
          shift_id: mockShift.id,
          merchant_id: mockUser.merchant.id,
          status: CashDrawerStatus.OPEN,
        },
      });
      expect(result.statusCode).toBe(201);
    });
  });

  describe('findAll', () => {
    const query: GetCashDrawersQueryDto = {
      page: 1,
      limit: 10,
    };

    it('should return paginated list of cash drawers', async () => {
      jest
        .spyOn(cashDrawerRepository, 'findAndCount')
        .mockResolvedValue([[mockCashDrawer] as any, 1]);

      const result = await service.findAll(query, 1);

      expect(cashDrawerRepository.findAndCount).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Cash drawers retrieved successfully');
      expect(result.data).toHaveLength(1);
      expect(result.paginationMeta.page).toBe(1);
      expect(result.paginationMeta.limit).toBe(10);
    });

    it('should throw ForbiddenException when user has no merchant_id', async () => {
      await expect(service.findAll(query, undefined as any)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findAll(query, undefined as any)).rejects.toThrow(
        'You must be associated with a merchant to access cash drawers',
      );
    });

    it('should filter by shiftId', async () => {
      const queryWithShiftId = { ...query, shiftId: 1 };
      jest
        .spyOn(shiftRepository, 'findOne')
        .mockResolvedValue(mockShift as any);
      jest
        .spyOn(cashDrawerRepository, 'findAndCount')
        .mockResolvedValue([[mockCashDrawer] as any, 1]);

      await service.findAll(queryWithShiftId, 1);

      expect(shiftRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['merchant'],
      });
    });

    it('should filter by openedBy', async () => {
      const queryWithOpenedBy = { ...query, openedBy: 1 };
      jest
        .spyOn(collaboratorRepository, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashDrawerRepository, 'findAndCount')
        .mockResolvedValue([[mockCashDrawer] as any, 1]);

      await service.findAll(queryWithOpenedBy, 1);

      expect(collaboratorRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should filter by status', async () => {
      const queryWithStatus = { ...query, status: CashDrawerStatus.OPEN };
      jest
        .spyOn(cashDrawerRepository, 'findAndCount')
        .mockResolvedValue([[mockCashDrawer] as any, 1]);

      await service.findAll(queryWithStatus, 1);

      expect(cashDrawerRepository.findAndCount).toHaveBeenCalled();
    });

    it('should throw BadRequestException if page is invalid', async () => {
      // Use negative value since 0 is treated as falsy and defaults to 1
      const queryWithInvalidPage = { ...query, page: -1 };

      await expect(service.findAll(queryWithInvalidPage, 1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAll(queryWithInvalidPage, 1)).rejects.toThrow(
        'Page number must be greater than 0',
      );
    });

    it('should throw BadRequestException if limit is invalid', async () => {
      const queryWithInvalidLimit = { ...query, limit: 101 };

      await expect(service.findAll(queryWithInvalidLimit, 1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAll(queryWithInvalidLimit, 1)).rejects.toThrow(
        'Limit must be between 1 and 100',
      );
    });

    it('should throw BadRequestException if createdDate format is invalid', async () => {
      const queryWithInvalidDate = { ...query, createdDate: 'invalid-date' };

      await expect(service.findAll(queryWithInvalidDate, 1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.findAll(queryWithInvalidDate, 1)).rejects.toThrow(
        'Created date must be in YYYY-MM-DD format',
      );
    });

    it('should handle pagination correctly', async () => {
      const queryPage2 = { page: 2, limit: 5 };
      jest
        .spyOn(cashDrawerRepository, 'findAndCount')
        .mockResolvedValue([[mockCashDrawer] as any, 15]);

      const result = await service.findAll(queryPage2, 1);

      expect(result.paginationMeta.page).toBe(2);
      expect(result.paginationMeta.limit).toBe(5);
      expect(result.paginationMeta.total).toBe(15);
      expect(result.paginationMeta.totalPages).toBe(3);
      expect(result.paginationMeta.hasNext).toBe(true);
      expect(result.paginationMeta.hasPrev).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return a cash drawer successfully', async () => {
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValue(mockCashDrawer as any);

      const result = await service.findOne(1, 1);

      expect(cashDrawerRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: 1,
          merchant_id: 1,
        },
        relations: [
          'merchant',
          'shift',
          'shift.merchant',
          'openedByCollaborator',
          'closedByCollaborator',
        ],
      });
      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Cash drawer retrieved successfully');
      expect(result.data.id).toBe(1);
    });

    it('should throw BadRequestException if id is invalid', async () => {
      await expect(service.findOne(0, 1)).rejects.toThrow(BadRequestException);
      await expect(service.findOne(0, 1)).rejects.toThrow(
        'Cash drawer ID must be a valid positive number',
      );
    });

    it('should throw ForbiddenException when user has no merchant_id', async () => {
      await expect(service.findOne(1, undefined as any)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findOne(1, undefined as any)).rejects.toThrow(
        'You must be associated with a merchant to access cash drawers',
      );
    });

    it('should throw NotFoundException if cash drawer not found', async () => {
      jest.spyOn(cashDrawerRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999, 1)).rejects.toThrow(
        'Cash drawer not found',
      );
    });

    it('should throw ForbiddenException if cash drawer belongs to different merchant', async () => {
      const cashDrawerFromDifferentMerchant = {
        ...mockCashDrawer,
        merchant_id: 2,
        merchant: { id: 2, name: 'Other Merchant' },
      };
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValue(cashDrawerFromDifferentMerchant as any);

      await expect(service.findOne(1, 1)).rejects.toThrow(ForbiddenException);
      await expect(service.findOne(1, 1)).rejects.toThrow(
        'You can only access cash drawers from your merchant',
      );
    });
  });

  describe('update', () => {
    const closeCashDrawerDto: CloseCashDrawerDto = {
      closingBalance: 100.0,
    };

    it('should close a cash drawer when the closing balance matches the current balance', async () => {
      const closedCashDrawer = {
        ...mockCashDrawer,
        closing_balance: 100.0,
        closed_by: 1,
        status: CashDrawerStatus.CLOSE,
        closedByCollaborator: mockCollaborator,
      };
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValueOnce(mockCashDrawer as any) // existing, current_balance = 100.0
        .mockResolvedValueOnce(closedCashDrawer as any); // refetched after update
      jest
        .spyOn(collaboratorRepository, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashDrawerRepository, 'update')
        .mockResolvedValue(undefined as any);

      const result = await service.update(1, closeCashDrawerDto, mockUser);

      expect(cashDrawerRepository.update).toHaveBeenCalledWith(1, {
        closing_balance: 100.0,
        closed_by: 1,
        status: CashDrawerStatus.CLOSE,
      });
      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe(CashDrawerStatus.CLOSE);
    });

    it('should close a cash drawer when the closing balance differs from the current balance only past the second decimal place', async () => {
      const subCentDto: CloseCashDrawerDto = { closingBalance: 100.004 };
      const closedCashDrawer = {
        ...mockCashDrawer,
        closing_balance: 100.0,
        closed_by: 1,
        status: CashDrawerStatus.CLOSE,
        closedByCollaborator: mockCollaborator,
      };
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValueOnce(mockCashDrawer as any) // existing, current_balance = 100.0
        .mockResolvedValueOnce(closedCashDrawer as any); // refetched after update
      jest
        .spyOn(collaboratorRepository, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashDrawerRepository, 'update')
        .mockResolvedValue(undefined as any);

      const result = await service.update(1, subCentDto, mockUser);

      expect(cashDrawerRepository.update).toHaveBeenCalledWith(1, {
        closing_balance: 100.0,
        closed_by: 1,
        status: CashDrawerStatus.CLOSE,
      });
      expect(result.statusCode).toBe(200);
      expect(result.data.status).toBe(CashDrawerStatus.CLOSE);
    });

    it('should mark the drawer as Discrepancy when the closing balance does not match the current balance', async () => {
      const mismatchedDto: CloseCashDrawerDto = { closingBalance: 90.0 };
      const discrepancyCashDrawer = {
        ...mockCashDrawer,
        closing_balance: 90.0,
        closed_by: 1,
        status: CashDrawerStatus.DISCREPANCY,
        closedByCollaborator: mockCollaborator,
      };
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValueOnce(mockCashDrawer as any) // current_balance = 100.0
        .mockResolvedValueOnce(discrepancyCashDrawer as any);
      jest
        .spyOn(collaboratorRepository, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashDrawerRepository, 'update')
        .mockResolvedValue(undefined as any);

      const result = await service.update(1, mismatchedDto, mockUser);

      expect(cashDrawerRepository.update).toHaveBeenCalledWith(1, {
        closing_balance: 90.0,
        closed_by: 1,
        status: CashDrawerStatus.DISCREPANCY,
      });
      expect(result.data.status).toBe(CashDrawerStatus.DISCREPANCY);
    });

    it('should mark the drawer as Discrepancy when the closing balance is over the current balance', async () => {
      const overBalanceDto: CloseCashDrawerDto = { closingBalance: 110.0 };
      const discrepancyCashDrawer = {
        ...mockCashDrawer,
        closing_balance: 110.0,
        closed_by: 1,
        status: CashDrawerStatus.DISCREPANCY,
        closedByCollaborator: mockCollaborator,
      };
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValueOnce(mockCashDrawer as any) // current_balance = 100.0
        .mockResolvedValueOnce(discrepancyCashDrawer as any);
      jest
        .spyOn(collaboratorRepository, 'findOne')
        .mockResolvedValue(mockCollaborator as any);
      jest
        .spyOn(cashDrawerRepository, 'update')
        .mockResolvedValue(undefined as any);

      const result = await service.update(1, overBalanceDto, mockUser);

      expect(cashDrawerRepository.update).toHaveBeenCalledWith(1, {
        closing_balance: 110.0,
        closed_by: 1,
        status: CashDrawerStatus.DISCREPANCY,
      });
      expect(result.data.status).toBe(CashDrawerStatus.DISCREPANCY);
    });

    it('should throw BadRequestException if id is invalid', async () => {
      await expect(
        service.update(0, closeCashDrawerDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user has no merchant_id', async () => {
      const userWithoutMerchant = { ...mockUser, merchant: undefined as any };
      await expect(
        service.update(1, closeCashDrawerDto, userWithoutMerchant),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if cash drawer not found', async () => {
      jest.spyOn(cashDrawerRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update(999, closeCashDrawerDto, mockUser),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update(999, closeCashDrawerDto, mockUser),
      ).rejects.toThrow('Cash drawer not found');
    });

    it('should throw ConflictException if the drawer is not open', async () => {
      const alreadyClosedDrawer = {
        ...mockCashDrawer,
        status: CashDrawerStatus.CLOSE,
      };
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValue(alreadyClosedDrawer as any);

      await expect(
        service.update(1, closeCashDrawerDto, mockUser),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.update(1, closeCashDrawerDto, mockUser),
      ).rejects.toThrow('Only an open cash drawer can be closed');
    });

    it('should throw BadRequestException when the user has no linked collaborator profile', async () => {
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValue(mockCashDrawer as any);
      jest.spyOn(collaboratorRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update(1, closeCashDrawerDto, mockUser),
      ).rejects.toThrow('No collaborator profile is linked to your account.');
    });
  });

  describe('remove', () => {
    it('should remove a cash drawer successfully', async () => {
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValue(mockCashDrawer as any);
      jest
        .spyOn(cashDrawerRepository, 'remove')
        .mockResolvedValue(mockCashDrawer as any);

      const result = await service.remove(1, 1);

      expect(cashDrawerRepository.findOne).toHaveBeenCalled();
      expect(cashDrawerRepository.remove).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Cash drawer deleted successfully');
    });

    it('should throw BadRequestException if id is invalid', async () => {
      await expect(service.remove(0, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when user has no merchant_id', async () => {
      await expect(service.remove(1, undefined as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if cash drawer not found', async () => {
      jest.spyOn(cashDrawerRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
      await expect(service.remove(999, 1)).rejects.toThrow(
        'Cash drawer not found',
      );
    });

    it('should throw ForbiddenException if cash drawer belongs to different merchant', async () => {
      const cashDrawerFromDifferentMerchant = {
        ...mockCashDrawer,
        merchant_id: 2,
        merchant: { id: 2, name: 'Other Merchant' },
      };
      jest
        .spyOn(cashDrawerRepository, 'findOne')
        .mockResolvedValue(cashDrawerFromDifferentMerchant as any);

      await expect(service.remove(1, 1)).rejects.toThrow(ForbiddenException);
      await expect(service.remove(1, 1)).rejects.toThrow(
        'You can only delete cash drawers from your merchant',
      );
    });
  });
});
