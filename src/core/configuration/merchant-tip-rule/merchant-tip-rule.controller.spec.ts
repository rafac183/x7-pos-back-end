//src/core/configuration/merchant-tip-rule/merchant-tip-rule.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyStatus } from 'src/platform-saas/companies/constants/company-status.enum';
import { MerchantTipRuleController } from './merchant-tip-rule.controller';
import { MerchantTipRuleService } from './merchant-tip-rule.service';
import { MerchantTipRule } from './entity/merchant-tip-rule-entity';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { TipCalculationMethod } from '../constants/tip-calculation-method.enum';
import { TipDistributionMethod } from '../constants/tip-distribution-method.enum';
import { User } from 'src/platform-saas/users/entities/user.entity';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';
import { UpdateMerchantTipRuleDto } from './dto/update-merchant-tip-rule.dto';

describe('MerchantTipRuleController', () => {
  let controller: MerchantTipRuleController;
  let service: MerchantTipRuleService;

  // Mock data
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

  const mockUser = {
    id: 1,
  } as User;

  const mockAuthenticatedUser: AuthenticatedUser = {
    id: 1,
    email: 'merchant-admin@test.com',
    role: UserRole.MERCHANT_ADMIN,
    scope: Scope.MERCHANT_WEB,
    merchant: { id: 10 },
  };

  const mockMerchantTipRule: MerchantTipRule = {
    id: 1,
    company: mockCompany,
    merchant_id: 10,
    merchant: { id: 10 } as Merchant,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUser,
    updatedBy: mockUser,
    status: 'active',
    name: 'Test Merchant Tip Rule',
    tipCalculationMethod: TipCalculationMethod.PERCENTAGE,
    tipDistributionMethod: TipDistributionMethod.INDIVIDUAL,
    suggestedPercentages: [10, 15, 20],
    fixedAmountOptions: [1, 2, 3],
    allowCustomTip: true,
    maximumTipPercentage: 25,
    autoDistribute: true,
  } as MerchantTipRule;

  const mockCreateMerchantTipRuleDto = {
    name: 'Test Merchant Tip Rule',
    tipCalculationMethod: TipCalculationMethod.PERCENTAGE,
    tipDistributionMethod: TipDistributionMethod.INDIVIDUAL,
    suggestedPercentages: [10, 15, 20],
    fixedAmountOptions: [1, 2, 3],
    allowCustomTip: true,
    maximumTipPercentage: 25,
    autoDistribute: true,
  };

  const mockPagination = {
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  const mockPaginatedResponse = {
    statusCode: 200,
    message: 'Merchant tip rules retrieved successfully',
    data: [mockMerchantTipRule],
    pagination: mockPagination,
  };

  const mockOneMerchantTipRuleResponse = {
    statusCode: 200,
    message: 'Merchant tip rule retrieved successfully',
    data: mockMerchantTipRule,
  };

  const mockUpdateMerchantTipRuleDto: UpdateMerchantTipRuleDto = {
    status: 'active',
    name: 'Test Merchant Tip Rule 2',
    tipCalculationMethod: TipCalculationMethod.CUSTOM,
    tipDistributionMethod: TipDistributionMethod.ROLE_BASED,
    suggestedPercentages: [10, 20, 30],
    fixedAmountOptions: [1, 2, 3],
    allowCustomTip: false,
    maximumTipPercentage: 50,
    autoDistribute: true,
  };

  beforeEach(async () => {
    const mockMerchantTipRuleService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantTipRuleController],
      providers: [
        {
          provide: MerchantTipRuleService,
          useValue: mockMerchantTipRuleService,
        },
      ],
    }).compile();

    controller = module.get<MerchantTipRuleController>(
      MerchantTipRuleController,
    );
    service = module.get<MerchantTipRuleService>(MerchantTipRuleService);
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
    it('should have Merchant Tip Rule Service defined', () => {
      expect(service).toBeDefined();
    });
  });

  //--------------------------------------------------------------
  // POST /merchant-tip-rule
  //--------------------------------------------------------------
  describe('POST /merchant-tip-rule', () => {
    it('should create a merchant tip rule successfully', async () => {
      const expectedResponse = {
        statusCode: 201,
        message: 'Merchant tip rule created successfully',
        data: mockMerchantTipRule,
      };

      const createSpy = jest
        .spyOn(service, 'create')
        .mockResolvedValue(expectedResponse);
      createSpy.mockResolvedValue(expectedResponse);

      const result = await controller.create(
        mockCreateMerchantTipRuleDto,
        mockAuthenticatedUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        mockCreateMerchantTipRuleDto,
        mockAuthenticatedUser,
      );
      expect(result).toEqual(expectedResponse);
    });

    it('should handle errors during creation', async () => {
      const errorMessage = 'Failed to create Merchant Tip Rule';
      const createSpy = jest
        .spyOn(service, 'create')
        .mockRejectedValue(new Error(errorMessage));
      createSpy.mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.create(mockCreateMerchantTipRuleDto, mockAuthenticatedUser),
      ).rejects.toThrow(errorMessage);

      expect(createSpy).toHaveBeenCalledWith(
        mockCreateMerchantTipRuleDto,
        mockAuthenticatedUser,
      );
    });
  });
  //--------------------------------------------------------------
  // GET /merchant-tip-rule
  //--------------------------------------------------------------
  describe('GET /merchant-tip-rule', () => {
    it('should retrieve all merchant tip rules successfully', async () => {
      const findAllSpy = jest
        .spyOn(service, 'findAll')
        .mockResolvedValue(mockPaginatedResponse);
      findAllSpy.mockResolvedValue(mockPaginatedResponse);

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
        message: 'Merchant tip rules retrieved successfully',
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
      findAllSpy.mockResolvedValue(emptyPaginatedResponse);

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
      const errorMessage = 'Failed to retrieve Merchant Tip Rules';
      const findAllSpy = jest
        .spyOn(service, 'findAll')
        .mockRejectedValue(new Error(errorMessage));
      findAllSpy.mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.findAll({ page: 1, limit: 10 }, mockAuthenticatedUser),
      ).rejects.toThrow(errorMessage);

      expect(findAllSpy).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        mockAuthenticatedUser,
      );
    });
  });
  //--------------------------------------------------------------
  // GET /merchant-tip-rule/:id
  //--------------------------------------------------------------
  describe('GET /merchant-tip-rule/:id', () => {
    it('should retrieve a merchant tip rule by id successfully', async () => {
      const findOneSpy = jest
        .spyOn(service, 'findOne')
        .mockResolvedValue(mockOneMerchantTipRuleResponse);
      findOneSpy.mockResolvedValue(mockOneMerchantTipRuleResponse);

      const result = await controller.findOne(1, mockAuthenticatedUser);

      expect(findOneSpy).toHaveBeenCalledWith(1, mockAuthenticatedUser);
      expect(result).toEqual(mockOneMerchantTipRuleResponse);
    });

    it('should handle errors when retrieving by ID', async () => {
      const errorMessage = 'Failed to retrieve Merchant Tip Rule';
      const findOneSpy = jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new Error(errorMessage));
      findOneSpy.mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.findOne(1, mockAuthenticatedUser),
      ).rejects.toThrow(errorMessage);

      expect(findOneSpy).toHaveBeenCalledWith(1, mockAuthenticatedUser);
    });
  });
  //--------------------------------------------------------------
  // PATCH /merchant-tip-rule/:id
  //--------------------------------------------------------------
  describe('PATCH /merchant-tip-rule/:id', () => {
    it('should update a merchant tip rule successfully', async () => {
      const updatedResponse = {
        statusCode: 200,
        message: 'Merchant Tip Rule updated successfully',
        data: mockMerchantTipRule,
      };
      const updateSpy = jest
        .spyOn(service, 'update')
        .mockResolvedValue(updatedResponse);
      updateSpy.mockResolvedValue(updatedResponse);

      const result = await controller.update(
        1,
        mockUpdateMerchantTipRuleDto,
        mockAuthenticatedUser,
      );

      expect(updateSpy).toHaveBeenCalledWith(
        1,
        mockUpdateMerchantTipRuleDto,
        mockAuthenticatedUser,
      );
      expect(result).toEqual(updatedResponse);
    });

    it('should handle errors during update', async () => {
      const errorMessage = 'Failed to update Merchant Tip Rule';
      const updateSpy = jest
        .spyOn(service, 'update')
        .mockRejectedValue(new Error(errorMessage));
      updateSpy.mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.update(1, mockUpdateMerchantTipRuleDto, mockAuthenticatedUser),
      ).rejects.toThrow(errorMessage);

      expect(updateSpy).toHaveBeenCalledWith(
        1,
        mockUpdateMerchantTipRuleDto,
        mockAuthenticatedUser,
      );
    });
  });
  //--------------------------------------------------------------
  // DELETE /merchant-tip-rule/:id
  //--------------------------------------------------------------
  describe('DELETE /merchant-tip-rule/:id', () => {
    it('should delete a merchant tip rule successfully', async () => {
      const deleteResponse = {
        statusCode: 200,
        message: 'Merchant Tip Rule deleted successfully',
        data: mockOneMerchantTipRuleResponse.data,
      };
      const removeSpy = jest
        .spyOn(service, 'remove')
        .mockResolvedValue(deleteResponse);
      removeSpy.mockResolvedValue(deleteResponse);

      const result = await controller.remove(1);

      expect(removeSpy).toHaveBeenCalledWith(1);
      expect(result).toEqual(deleteResponse);
    });

    it('should handle errors during deletion', async () => {
      const errorMessage = 'Failed to delete Merchant Tip Rule';
      const removeSpy = jest
        .spyOn(service, 'remove')
        .mockRejectedValue(new Error(errorMessage));
      removeSpy.mockRejectedValue(new Error(errorMessage));

      await expect(controller.remove(1)).rejects.toThrow(errorMessage);

      expect(removeSpy).toHaveBeenCalledWith(1);
    });
  });
});
