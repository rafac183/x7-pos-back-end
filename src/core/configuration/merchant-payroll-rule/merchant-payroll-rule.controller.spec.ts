//src/core/configuration/merchant-payroll-rule/merchant-payroll-rule.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyStatus } from 'src/platform-saas/companies/constants/company-status.enum';
import { MerchantPayrollRuleController } from './merchant-payroll-rule.controller';
import { MerchantPayrollRuleService } from './merchant-payroll-rule.service';
import { MerchantPayrollRule } from './entity/merchant-payroll-rule.entity';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { User } from 'src/platform-saas/users/entities/user.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { PayrollFrequency } from '../constants/payroll-frequency.enum';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';
import { CreateMerchantPayrollRuleDto } from './dto/create-merchant-payroll-rule.dto';
import { UpdateMerchantPayrollRuleDto } from './dto/update-merchant-payroll-rule.dto';

describe('MerchantPayrollRuleController', () => {
  let controller: MerchantPayrollRuleController;
  let service: MerchantPayrollRuleService;

  const mockCompany: Company = {
    id: 1,
    name: 'Test Company',
    email: 'test@company.com',
    phone: '1234567890',
    rut: '12345678-9',
    address: '123 Test St',
    city: 'Test City',
    state: 'Test State',
    country: 'Test Country',
    merchants: [],
    customers: [],
    configurations: [],
    suppliers: [],
  } as Company;

  const mockUser = { id: 1 } as User;

  const mockMerchant: Merchant = {
    id: 10,
  } as Merchant;

  const mockAuthenticatedUser: AuthenticatedUser = {
    id: 1,
    email: 'merchant-admin@test.com',
    role: UserRole.MERCHANT_ADMIN,
    scope: Scope.MERCHANT_WEB,
    merchant: { id: 10 },
  };

  const mockMerchantPayrollRule: MerchantPayrollRule = {
    id: 1,
    company: mockCompany,
    merchant_id: 10,
    merchant: mockMerchant,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUser,
    updatedBy: mockUser,
    status: 'active',
    name: 'Test Merchant Payroll Rule',
    frequencyPayroll: PayrollFrequency.CUSTOM,
    payDayOfWeek: 2,
    payDayOfMonth: 23,
    allowNegativePayroll: true,
    roundingPrecision: 2,
    currency: 'CLP',
    autoApprovePayroll: true,
    requiresManagerApproval: true,
  };

  const mockCreateMerchantPayrollRuleDto: CreateMerchantPayrollRuleDto = {
    name: 'Test Merchant Payroll Rule',
    frequencyPayroll: PayrollFrequency.CUSTOM,
    payDayOfWeek: 2,
    payDayOfMonth: 23,
    allowNegativePayroll: true,
    roundingPrecision: 2,
    currency: 'CLP',
    autoApprovePayroll: true,
    requiresManagerApproval: true,
  };

  const mockUpdateMerchantPayrollRuleDto: UpdateMerchantPayrollRuleDto = {
    status: 'inactive',
    name: 'Update Merchant Payroll Rule',
    frequencyPayroll: PayrollFrequency.MONTHLY,
    payDayOfWeek: 7,
    payDayOfMonth: 31,
    allowNegativePayroll: false,
    roundingPrecision: 1,
    currency: 'USD',
    autoApprovePayroll: true,
    requiresManagerApproval: true,
  };

  const mockPagination = { total: 1, page: 1, limit: 10, totalPages: 1 };
  const mockPaginatedResponse = {
    statusCode: 200,
    message: 'Merchant Payroll Rules retrieved successfully',
    data: [mockMerchantPayrollRule],
    pagination: mockPagination,
  };
  const mockOneMerchantPayrollRuleResponseDto = {
    statusCode: 200,
    message: 'Merchant Payroll Rule retrieved successfully',
    data: mockMerchantPayrollRule,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantPayrollRuleController],
      providers: [{ provide: MerchantPayrollRuleService, useValue: mockService }],
    }).compile();

    controller = module.get<MerchantPayrollRuleController>(MerchantPayrollRuleController);
    service = module.get<MerchantPayrollRuleService>(MerchantPayrollRuleService);
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
    it('should have Merchant Payroll Rule Service defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('POST /merchant-payroll-rule', () => {
    it('should create a merchant payroll rule successfully', async () => {
      const expectedResponse = {
        statusCode: 201,
        message: 'Merchant Payroll Rule created successfully',
        data: mockMerchantPayrollRule,
      };
      const createSpy = jest.spyOn(service, 'create').mockResolvedValue(expectedResponse);

      const result = await controller.create(mockCreateMerchantPayrollRuleDto, mockAuthenticatedUser);

      expect(createSpy).toHaveBeenCalledWith(mockCreateMerchantPayrollRuleDto, mockAuthenticatedUser);
      expect(result).toEqual(expectedResponse);
    });

    it('should handle errors during creation', async () => {
      const errorMessage = 'Failed to create Merchant Payroll Rule';
      jest.spyOn(service, 'create').mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.create(mockCreateMerchantPayrollRuleDto, mockAuthenticatedUser),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('GET /merchant-payroll-rule', () => {
    it('should retrieve all merchant payroll rules successfully', async () => {
      const findAllSpy = jest.spyOn(service, 'findAll').mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findAll({ page: 1, limit: 10 }, mockAuthenticatedUser);

      expect(findAllSpy).toHaveBeenCalledWith({ page: 1, limit: 10 }, mockAuthenticatedUser);
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should return empty list with pagination', async () => {
      const emptyResponse = {
        statusCode: 200,
        message: 'Merchant Payroll Rules retrieved successfully',
        data: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
      jest.spyOn(service, 'findAll').mockResolvedValue(emptyResponse);

      const result = await controller.findAll({ page: 1, limit: 10 }, mockAuthenticatedUser);

      expect(result).toEqual(emptyResponse);
    });

    it('should handle service errors in findAll', async () => {
      jest.spyOn(service, 'findAll').mockRejectedValue(new Error('boom'));

      await expect(
        controller.findAll({ page: 1, limit: 10 }, mockAuthenticatedUser),
      ).rejects.toThrow('boom');
    });
  });

  describe('GET /merchant-payroll-rule/:id', () => {
    it('should retrieve a merchant payroll rule by id successfully', async () => {
      const findOneSpy = jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(mockOneMerchantPayrollRuleResponseDto);

      const result = await controller.findOne(1, mockAuthenticatedUser);

      expect(findOneSpy).toHaveBeenCalledWith(1, mockAuthenticatedUser);
      expect(result).toEqual(mockOneMerchantPayrollRuleResponseDto);
    });

    it('should handle errors when retrieving by ID', async () => {
      jest.spyOn(service, 'findOne').mockRejectedValue(new Error('not found'));

      await expect(controller.findOne(1, mockAuthenticatedUser)).rejects.toThrow('not found');
    });
  });

  describe('PATCH /merchant-payroll-rule/:id', () => {
    it('should update a merchant payroll rule successfully', async () => {
      const updatedResponse = {
        statusCode: 200,
        message: 'Merchant Payroll Rule updated successfully',
        data: mockMerchantPayrollRule,
      };
      const updateSpy = jest.spyOn(service, 'update').mockResolvedValue(updatedResponse);

      const result = await controller.update(1, mockUpdateMerchantPayrollRuleDto, mockAuthenticatedUser);

      expect(updateSpy).toHaveBeenCalledWith(1, mockUpdateMerchantPayrollRuleDto, mockAuthenticatedUser);
      expect(result).toEqual(updatedResponse);
    });

    it('should handle errors during update', async () => {
      jest.spyOn(service, 'update').mockRejectedValue(new Error('forbidden'));

      await expect(
        controller.update(1, mockUpdateMerchantPayrollRuleDto, mockAuthenticatedUser),
      ).rejects.toThrow('forbidden');
    });
  });

  describe('DELETE /merchant-payroll-rule/:id', () => {
    it('should delete a merchant payroll rule successfully', async () => {
      const deleteResponse = {
        statusCode: 200,
        message: 'Merchant Payroll Rule deleted successfully',
        data: mockMerchantPayrollRule,
      };
      const removeSpy = jest.spyOn(service, 'remove').mockResolvedValue(deleteResponse);

      const result = await controller.remove(1);

      expect(removeSpy).toHaveBeenCalledWith(1);
      expect(result).toEqual(deleteResponse);
    });

    it('should handle errors during deletion', async () => {
      jest.spyOn(service, 'remove').mockRejectedValue(new Error('not found'));

      await expect(controller.remove(1)).rejects.toThrow('not found');
    });
  });
});
