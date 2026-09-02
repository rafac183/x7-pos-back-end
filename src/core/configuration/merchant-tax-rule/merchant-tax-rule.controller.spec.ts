//src/core/configuration/merchant-tax-rule/merchant-tax-rule.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyStatus } from 'src/platform-saas/companies/constants/company-status.enum';
import { MerchantTaxRuleController } from './merchant-tax-rule.controller';
import { MerchantTaxRuleService } from './merchant-tax-rule.service';
import { MerchantTaxRule } from './entity/merchant-tax-rule.entity';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { User } from 'src/platform-saas/users/entities/user.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { TaxType } from '../constants/tax-type.enum';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';
import { CreateMerchantTaxRuleDto } from './dto/create-merchant-tax-rule.dto';
import { UpdateMerchantTaxRuleDto } from './dto/update-merchant-tax-rule.dto';

describe('MerchantTaxRuleController', () => {
  let controller: MerchantTaxRuleController;
  let service: MerchantTaxRuleService;

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
    suppliers: [],
    configurations: [],
  } as Company;

  const mockUser = {
    id: 1,
    username: 'admin',
    email: 'merchant-admin@test.com',
  } as User;

  const mockAuthenticatedUser: AuthenticatedUser = {
    id: 1,
    email: 'merchant-admin@test.com',
    role: UserRole.MERCHANT_ADMIN,
    scope: Scope.MERCHANT_WEB,
    merchant: { id: 10 },
  };

  const mockMerchantTaxRule: MerchantTaxRule = {
    id: 1,
    company: mockCompany,
    merchant_id: 10,
    merchant: { id: 10 } as Merchant,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUser,
    updatedBy: mockUser,
    status: 'active',
    name: 'Test Merchant Tax Rule',
    description: 'Description of the merchant tax rule',
    taxType: TaxType.COMPOUND,
    rate: 0.19,
    appliesToTips: true,
    appliesToOvertime: true,
    isCompound: true,
    externalTaxCode: 'lfgtr-hhse',
  };

  const mockCreateMerchantTaxRuleDto: CreateMerchantTaxRuleDto = {
    name: 'Test Merchant Tax Rule',
    description: 'Description of the merchant tax rule',
    taxType: TaxType.COMPOUND,
    rate: 0.19,
    appliesToTips: true,
    appliesToOvertime: true,
    externalTaxCode: 'lfgtr-hhse',
  };

  const mockPagination = {
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  const mockPaginatedResponse = {
    statusCode: 200,
    message: 'Merchant Tax rules retrieved successfully',
    data: [mockMerchantTaxRule],
    pagination: mockPagination,
  };

  const mockOneMerchantTaxRuleResponseDto = {
    statusCode: 200,
    message: 'Merchant Tax rule retrieved successfully',
    data: mockMerchantTaxRule,
  };

  const mockUpdateMerchantTaxRuleDto: UpdateMerchantTaxRuleDto = {
    status: 'inactive',
    name: 'Update Merchant Tax Rule',
    description: 'Description of the merchant tax rule',
    taxType: TaxType.COMPOUND,
    rate: 0.15,
    appliesToTips: false,
    appliesToOvertime: true,
    externalTaxCode: 'lfgtr-hhse',
  };

  beforeEach(async () => {
    const mockMerchantTaxRuleService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantTaxRuleController],
      providers: [
        {
          provide: MerchantTaxRuleService,
          useValue: mockMerchantTaxRuleService,
        },
      ],
    }).compile();

    controller = module.get<MerchantTaxRuleController>(
      MerchantTaxRuleController,
    );
    service = module.get<MerchantTaxRuleService>(MerchantTaxRuleService);
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
    it('should have Merchant Tax Rule Service defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('POST /merchant-tax-rule', () => {
    it('should create a merchant tax rule successfully', async () => {
      const expectedResponse = {
        statusCode: 201,
        message: 'Merchant tax rule created successfully',
        data: mockMerchantTaxRule,
      };

      const createSpy = jest
        .spyOn(service, 'create')
        .mockResolvedValue(expectedResponse);

      const result = await controller.create(
        mockCreateMerchantTaxRuleDto,
        mockAuthenticatedUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        mockCreateMerchantTaxRuleDto,
        mockAuthenticatedUser,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should handle errors during creation', async () => {
      const errorMessage = 'Failed to create Merchant Tax Rule';
      const createSpy = jest
        .spyOn(service, 'create')
        .mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.create(mockCreateMerchantTaxRuleDto, mockAuthenticatedUser),
      ).rejects.toThrow(errorMessage);

      expect(createSpy).toHaveBeenCalledWith(
        mockCreateMerchantTaxRuleDto,
        mockAuthenticatedUser,
      );
    });
  });

  describe('GET /merchant-tax-rule', () => {
    it('should retrieve all merchant tax rules successfully', async () => {
      const findAllSpy = jest
        .spyOn(service, 'findAll')
        .mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findAll(
        { page: 1, limit: 10 },
        mockAuthenticatedUser,
      );

      expect(findAllSpy).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        mockAuthenticatedUser,
      );
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('should return empty list with pagination', async () => {
      const emptyPaginatedResponse = {
        statusCode: 200,
        message: 'Merchant tax rules retrieved successfully',
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      };

      const findAllSpy = jest
        .spyOn(service, 'findAll')
        .mockResolvedValue(emptyPaginatedResponse);

      const result = await controller.findAll(
        { page: 1, limit: 10 },
        mockAuthenticatedUser,
      );

      expect(findAllSpy).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        mockAuthenticatedUser,
      );
      expect(result).toEqual(emptyPaginatedResponse);
    });

    it('should handle service errors in findAll', async () => {
      const errorMessage = 'Failed to retrieve Merchant Tax Rules';
      const findAllSpy = jest
        .spyOn(service, 'findAll')
        .mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.findAll({ page: 1, limit: 10 }, mockAuthenticatedUser),
      ).rejects.toThrow(errorMessage);

      expect(findAllSpy).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        mockAuthenticatedUser,
      );
    });
  });

  describe('GET /merchant-tax-rule/:id', () => {
    it('should retrieve a merchant tax rule by id successfully', async () => {
      const findOneSpy = jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(mockOneMerchantTaxRuleResponseDto);

      const result = await controller.findOne(1, mockAuthenticatedUser);

      expect(findOneSpy).toHaveBeenCalledWith(1, mockAuthenticatedUser);
      expect(result).toEqual(mockOneMerchantTaxRuleResponseDto);
    });

    it('should handle errors when retrieving by ID', async () => {
      const errorMessage = 'Failed to retrieve Merchant Tax Rule';
      const findOneSpy = jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.findOne(1, mockAuthenticatedUser),
      ).rejects.toThrow(errorMessage);

      expect(findOneSpy).toHaveBeenCalledWith(1, mockAuthenticatedUser);
    });
  });

  describe('PATCH /merchant-tax-rule/:id', () => {
    it('should update a merchant tax rule successfully', async () => {
      const updatedResponse = {
        statusCode: 200,
        message: 'Merchant Tax Rule updated successfully',
        data: mockMerchantTaxRule,
      };
      const updateSpy = jest
        .spyOn(service, 'update')
        .mockResolvedValue(updatedResponse);

      const result = await controller.update(
        1,
        mockUpdateMerchantTaxRuleDto,
        mockAuthenticatedUser,
      );

      expect(updateSpy).toHaveBeenCalledWith(
        1,
        mockUpdateMerchantTaxRuleDto,
        mockAuthenticatedUser,
      );
      expect(result).toEqual(updatedResponse);
    });

    it('should handle errors during update', async () => {
      const errorMessage = 'Failed to update Merchant Tax Rule';
      const updateSpy = jest
        .spyOn(service, 'update')
        .mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.update(
          1,
          mockUpdateMerchantTaxRuleDto,
          mockAuthenticatedUser,
        ),
      ).rejects.toThrow(errorMessage);

      expect(updateSpy).toHaveBeenCalledWith(
        1,
        mockUpdateMerchantTaxRuleDto,
        mockAuthenticatedUser,
      );
    });
  });

  describe('DELETE /merchant-tax-rule/:id', () => {
    it('should delete a merchant tax rule successfully', async () => {
      const deleteResponse = {
        statusCode: 200,
        message: 'Merchant Tax Rule deleted successfully',
        data: mockOneMerchantTaxRuleResponseDto.data,
      };
      const removeSpy = jest
        .spyOn(service, 'remove')
        .mockResolvedValue(deleteResponse);

      const result = await controller.remove(1);

      expect(removeSpy).toHaveBeenCalledWith(1);
      expect(result).toEqual(deleteResponse);
    });

    it('should handle errors during deletion', async () => {
      const errorMessage = 'Failed to delete Merchant Tax Rule';
      const removeSpy = jest
        .spyOn(service, 'remove')
        .mockRejectedValue(new Error(errorMessage));

      await expect(controller.remove(1)).rejects.toThrow(errorMessage);

      expect(removeSpy).toHaveBeenCalledWith(1);
    });
  });
});
