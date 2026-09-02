//src/core/configuration/merchant-tip-rule/merchant-tip-rule.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyStatus } from 'src/platform-saas/companies/constants/company-status.enum';
import { MerchantTipRuleService } from './merchant-tip-rule.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MerchantTipRule } from './entity/merchant-tip-rule-entity';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { TipCalculationMethod } from '../constants/tip-calculation-method.enum';
import { TipDistributionMethod } from '../constants/tip-distribution-method.enum';
import { CreateMerchantTipRuleDto } from './dto/create-merchant-tip-rule.dto';
import { UpdateMerchantTipRuleDto } from './dto/update-merchant-tip-rule.dto';
import { SelectQueryBuilder } from 'typeorm';
import { Repository, In } from 'typeorm';
import { User } from 'src/platform-saas/users/entities/user.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';

const TIP_RULE_SELECT_FIELDS = [
  'merchantTipRule',
  'company.id',
  'createdBy.id',
  'createdBy.username',
  'createdBy.email',
  'updatedBy.id',
  'updatedBy.username',
  'updatedBy.email',
  'merchant.id',
  'merchant.name',
];

describe('MerchantTipRuleService', () => {
  let service: MerchantTipRuleService;
  let merchantTipRuleRepository: Repository<MerchantTipRule>;
  let companyRepository: Repository<Company>;
  let userRepository: Repository<User>;
  let merchantRepository: Repository<Merchant>;

  const mockMerchantAdminUser: AuthenticatedUser = {
    id: 1,
    email: 'merchant-admin@test.com',
    role: UserRole.MERCHANT_ADMIN,
    scope: Scope.MERCHANT_WEB,
    merchant: { id: 10 },
  };

  const mockPortalAdminUser: AuthenticatedUser = {
    id: 2,
    email: 'portal-admin@test.com',
    role: UserRole.PORTAL_ADMIN,
    scope: Scope.ADMIN_PORTAL,
    merchant: { id: 0 },
  };

  //Mock data
  const mockMerchantTipRule: Partial<MerchantTipRule> = {
    id: 1,
    company: {
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
    } as Company,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: 1 } as User,
    updatedBy: { id: 1 } as User,
    status: 'active',
    name: 'Test Merchant Tip Rule',
    tipCalculationMethod: TipCalculationMethod.PERCENTAGE,
    tipDistributionMethod: TipDistributionMethod.INDIVIDUAL,
    suggestedPercentages: [10, 15, 20],
    fixedAmountOptions: [1, 2, 3],
    allowCustomTip: true,
    maximumTipPercentage: 25,
    autoDistribute: true,
  };

  const mockCreateMerchantTipRuleDto: CreateMerchantTipRuleDto = {
    name: 'Test Merchant Tip Rule',
    tipCalculationMethod: TipCalculationMethod.PERCENTAGE,
    tipDistributionMethod: TipDistributionMethod.INDIVIDUAL,
    suggestedPercentages: [0.5, 0.3, 0.2],
    fixedAmountOptions: [1, 2, 3],
    allowCustomTip: true,
    maximumTipPercentage: 25,
    autoDistribute: true,
  };

  const mockUpdateMerchantTipRuleDto: UpdateMerchantTipRuleDto = {
    status: 'inactive',
    name: 'Updated Merchant Tip Rule',
    tipCalculationMethod: TipCalculationMethod.FIXED_AMOUNT,
    tipDistributionMethod: TipDistributionMethod.POOL,
    suggestedPercentages: [5, 10, 15],
    fixedAmountOptions: [2, 4, 6],
    allowCustomTip: false,
    maximumTipPercentage: 20,
    autoDistribute: false,
  };

  beforeEach(async () => {
    const mockQueryBuilder: any = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockMerchantTipRule], 1]),
      getOne: jest.fn().mockResolvedValue(mockMerchantTipRule),
    };

    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantTipRuleService,
        {
          provide: getRepositoryToken(MerchantTipRule),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MerchantTipRuleService>(MerchantTipRuleService);
    merchantTipRuleRepository = module.get<Repository<MerchantTipRule>>(
      getRepositoryToken(MerchantTipRule),
    );
    companyRepository = module.get<Repository<Company>>(
      getRepositoryToken(Company),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    merchantRepository = module.get<Repository<Merchant>>(
      getRepositoryToken(Merchant),
    );
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
    it('repository should be defined', () => {
      expect(merchantTipRuleRepository).toBeDefined();
    });
  });

  describe('Create Merchant Tip Rule', () => {
    it('should create and return a merchant tip rule successfully', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({
        id: 7,
      } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);

      const createSpy = jest.spyOn(merchantTipRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantTipRuleRepository, 'save');

      createSpy.mockReturnValue(mockMerchantTipRule as MerchantTipRule);
      saveSpy.mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      const result = await service.create(
        mockCreateMerchantTipRuleDto,
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          company: { id: 7 },
          status: 'active',
        }),
      );
      expect(saveSpy).toHaveBeenCalledWith(mockMerchantTipRule);
      expect(result).toEqual({
        statusCode: 201,
        message: 'Merchant Tip Rule created successfully',
        data: mockMerchantTipRule,
      });
    });

    it('should handle database errors during creation', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({
        id: 7,
      } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);

      const createSpy = jest.spyOn(merchantTipRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantTipRuleRepository, 'save');

      createSpy.mockReturnValue(mockMerchantTipRule as MerchantTipRule);
      saveSpy.mockRejectedValue(new Error('Database error'));

      await expect(
        service.create(mockCreateMerchantTipRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Database error');

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          company: { id: 7 },
        }),
      );
      expect(saveSpy).toHaveBeenCalledWith(mockMerchantTipRule);
    });

    it('throws forbidden when the creating user has no resolvable merchant', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create(mockCreateMerchantTipRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('scopes the createdBy lookup to id/username/email only', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({
        id: 7,
      } as Company);
      const userFindOneSpy = jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as User);
      jest
        .spyOn(merchantTipRuleRepository, 'create')
        .mockReturnValue(mockMerchantTipRule as MerchantTipRule);
      jest
        .spyOn(merchantTipRuleRepository, 'save')
        .mockResolvedValue(mockMerchantTipRule as MerchantTipRule);

      await service.create(mockCreateMerchantTipRuleDto, mockMerchantAdminUser);

      expect(userFindOneSpy).toHaveBeenCalledWith({
        where: { id: 1 },
        select: ['id', 'username', 'email'],
      });
    });

    it('rejects suggested percentages that do not sum to 100 for percentage calculation', async () => {
      await expect(
        service.create(
          { ...mockCreateMerchantTipRuleDto, suggestedPercentages: [0.15, 0.2] },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow('Suggested percentages must sum to 100%');
    });

    it('accepts a single 100% suggested percentage (one worker takes the full tip)', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({
        id: 7,
      } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);
      jest
        .spyOn(merchantTipRuleRepository, 'create')
        .mockReturnValue(mockMerchantTipRule as MerchantTipRule);
      jest
        .spyOn(merchantTipRuleRepository, 'save')
        .mockResolvedValue(mockMerchantTipRule as MerchantTipRule);

      await expect(
        service.create(
          { ...mockCreateMerchantTipRuleDto, suggestedPercentages: [1] },
          mockMerchantAdminUser,
        ),
      ).resolves.toBeDefined();
    });

    it('skips the sum check entirely for non-percentage calculation methods', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({
        id: 7,
      } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);
      jest
        .spyOn(merchantTipRuleRepository, 'create')
        .mockReturnValue(mockMerchantTipRule as MerchantTipRule);
      jest
        .spyOn(merchantTipRuleRepository, 'save')
        .mockResolvedValue(mockMerchantTipRule as MerchantTipRule);

      await expect(
        service.create(
          {
            ...mockCreateMerchantTipRuleDto,
            tipCalculationMethod: TipCalculationMethod.FIXED_AMOUNT,
            suggestedPercentages: [],
            fixedAmountOptions: [5, 10],
          },
          mockMerchantAdminUser,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('Find All Merchant Tip Rules', () => {
    it('should return all merchant tip rules', async () => {
      const mockMerchantTipRules = [mockMerchantTipRule as MerchantTipRule];

      // QueryBuilder ya mockeado en el beforeEach
      const qb = merchantTipRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTipRule>
      >;

      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([mockMerchantTipRules, mockMerchantTipRules.length]);

      const result = await service.findAll(
        {
          page: 1,
          limit: 10,
        },
        mockPortalAdminUser,
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Tip Rules retrieved successfully',
        data: mockMerchantTipRules,
        pagination: {
          page: 1,
          limit: 10,
          total: mockMerchantTipRules.length,
          totalPages: 1,
        },
      });
    });

    it('should return an empty array when no merchant tip rule found', async () => {
      const qb = merchantTipRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTipRule>
      >;

      jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);

      const result = await service.findAll(
        {
          page: 1,
          limit: 10,
        },
        mockPortalAdminUser,
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Tip Rules retrieved successfully',
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      });
    });

    it("scopes the query to the merchant admin's company", async () => {
      const qb = merchantTipRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTipRule>
      >;
      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([[mockMerchantTipRule as MerchantTipRule], 1]);
      const merchantFindOneSpy = jest
        .spyOn(merchantRepository, 'findOne')
        .mockResolvedValue({ id: 10, companyId: 7 } as Merchant);

      await service.findAll({ page: 1, limit: 10 }, mockMerchantAdminUser);

      expect(merchantFindOneSpy).toHaveBeenCalledWith({
        where: { id: 10 },
        select: ['id', 'companyId'],
      });
      expect(qb.andWhere).toHaveBeenCalledWith('company.id = :companyId', {
        companyId: 7,
      });
    });

    it('does not scope the query for a portal admin', async () => {
      const qb = merchantTipRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTipRule>
      >;
      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([[mockMerchantTipRule as MerchantTipRule], 1]);
      const merchantFindOneSpy = jest.spyOn(merchantRepository, 'findOne');

      await service.findAll({ page: 1, limit: 10 }, mockPortalAdminUser);

      expect(merchantFindOneSpy).not.toHaveBeenCalled();
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'company.id = :companyId',
        expect.anything(),
      );
    });

    it('throws when the merchant admin has no resolvable company', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.findAll({ page: 1, limit: 10 }, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('includes username in the selected audit fields', async () => {
      const qb = merchantTipRuleRepository.createQueryBuilder() as any;
      qb.getManyAndCount.mockResolvedValue([[mockMerchantTipRule], 1]);

      await service.findAll({ page: 1, limit: 10 }, mockPortalAdminUser);

      expect(qb.select).toHaveBeenCalledWith(TIP_RULE_SELECT_FIELDS);
    });
  });

  describe('Find One Merchant Tip Rule', () => {
    it('should throw error for invalid ID (null)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await expect(
        service.findOne(null as any, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should throw error for invalid ID (zero)', async () => {
      await expect(
        service.findOne(0, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should throw error for invalid ID (negative)', async () => {
      await expect(
        service.findOne(-1, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should handle not found merchant tip rule', async () => {
      const qb = merchantTipRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(null);

      await expect(
        service.findOne(999, mockMerchantAdminUser),
      ).rejects.toThrow('Merchant Tip Rule not found');
    });

    it('scopes findOne to a safe field list via queryBuilder instead of loading raw relations', async () => {
      const qb = merchantTipRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      const repoFindOneSpy = jest.spyOn(merchantTipRuleRepository, 'findOne');
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);

      await service.findOne(1, mockMerchantAdminUser);

      expect(qb.select).toHaveBeenCalledWith(TIP_RULE_SELECT_FIELDS);
      expect(repoFindOneSpy).not.toHaveBeenCalled();
    });

    it('should return a merchant tip rule when found', async () => {
      const qb = merchantTipRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);

      const result = await service.findOne(1, mockMerchantAdminUser);

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Tip Rule retrieved successfully',
        data: mockMerchantTipRule,
      });
    });

    it('forbids viewing a tip rule owned by a different company', async () => {
      const qb = merchantTipRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      jest
        .spyOn(merchantRepository, 'findOne')
        .mockResolvedValue({ id: 10, companyId: 999 } as Merchant);

      await expect(
        service.findOne(1, mockMerchantAdminUser),
      ).rejects.toThrow();
    });
  });

  describe('Update Merchant Tip Rule', () => {
    it('should update and return a merchant tip rule successfully', async () => {
      const updatedMerchantTipRule: Partial<MerchantTipRule> = {
        ...mockMerchantTipRule,
        ...mockUpdateMerchantTipRuleDto,
        company: mockMerchantTipRule.company,
        createdBy: mockMerchantTipRule.createdBy,
        updatedBy: mockMerchantTipRule.updatedBy,
      };

      const findOneSpy = jest.spyOn(merchantTipRuleRepository, 'findOne');
      const saveSpy = jest.spyOn(merchantTipRuleRepository, 'save');

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as User);
      jest
        .spyOn(companyRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as Company);

      findOneSpy.mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      saveSpy.mockResolvedValue(updatedMerchantTipRule as MerchantTipRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);
      const result = await service.update(
        1,
        mockUpdateMerchantTipRuleDto,
        mockMerchantAdminUser,
      );

      expect(findOneSpy).toHaveBeenCalledWith({
        where: {
          id: 1,
          status: In(['active', 'inactive']),
        },
        relations: ['company', 'merchant'],
      });
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updatedMerchantTipRule,
          updatedAt: expect.any(Date),
        }),
      );
      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Tip Rule updated successfully',
        data: updatedMerchantTipRule,
      });
    });

    it('should throw error for invalid ID during update', async () => {
      await expect(
        service.update(0, mockUpdateMerchantTipRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should throw error when merchant tip rule to update not found', async () => {
      const findOneSpy = jest.spyOn(merchantTipRuleRepository, 'findOne');
      findOneSpy.mockResolvedValue(null);

      await expect(
        service.update(999, mockUpdateMerchantTipRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Merchant Tip Rule not found');
      expect(findOneSpy).toHaveBeenCalledWith({
        where: {
          id: 999,
          status: In(['active', 'inactive']),
        },
        relations: ['company', 'merchant'],
      });
    });

    it('should handle database errors during update', async () => {
      const findOneSpy = jest.spyOn(merchantTipRuleRepository, 'findOne');
      const saveSpy = jest.spyOn(merchantTipRuleRepository, 'save');

      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as User);
      jest
        .spyOn(companyRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as Company);

      findOneSpy.mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      saveSpy.mockRejectedValue(new Error('Database error'));
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);

      await expect(
        service.update(1, mockUpdateMerchantTipRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Database error');
    });

    it('forbids updating a tip rule owned by a different company', async () => {
      jest
        .spyOn(merchantTipRuleRepository, 'findOne')
        .mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      jest
        .spyOn(merchantRepository, 'findOne')
        .mockResolvedValue({ id: 10, companyId: 999 } as Merchant);

      await expect(
        service.update(1, mockUpdateMerchantTipRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('always sets updatedBy and updatedAt from the session user, ignoring any client value', async () => {
      const findOneSpy = jest.spyOn(merchantTipRuleRepository, 'findOne');
      findOneSpy.mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);
      const sessionUser = { id: 1, username: 'session-user', email: 'session@test.com' } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(sessionUser);
      const saveSpy = jest
        .spyOn(merchantTipRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantTipRule);

      await service.update(1, mockUpdateMerchantTipRuleDto, mockMerchantAdminUser);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedBy: sessionUser,
          updatedAt: expect.any(Date),
        }),
      );
    });

    it('rejects an update where suggested percentages do not sum to 100 for percentage calculation', async () => {
      jest
        .spyOn(merchantTipRuleRepository, 'findOne')
        .mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);

      await expect(
        service.update(
          1,
          {
            tipCalculationMethod: TipCalculationMethod.PERCENTAGE,
            suggestedPercentages: [0.5, 0.2],
          },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow('Suggested percentages must sum to 100%');
    });

    it('accepts an update where suggested percentages sum to exactly 100', async () => {
      jest
        .spyOn(merchantTipRuleRepository, 'findOne')
        .mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as User);
      jest
        .spyOn(merchantTipRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantTipRule);

      await expect(
        service.update(
          1,
          {
            tipCalculationMethod: TipCalculationMethod.PERCENTAGE,
            suggestedPercentages: [0.2, 0.8],
          },
          mockMerchantAdminUser,
        ),
      ).resolves.toBeDefined();
    });

    it('falls back to the persisted suggestedPercentages when switching to percentage calculation without supplying new percentages', async () => {
      jest.spyOn(merchantTipRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantTipRule,
        tipCalculationMethod: TipCalculationMethod.PERCENTAGE,
        suggestedPercentages: [0.3, 0.3],
      } as MerchantTipRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as User);

      await expect(
        service.update(
          1,
          { tipCalculationMethod: TipCalculationMethod.PERCENTAGE },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow('Suggested percentages must sum to 100%');
    });

    it('rejects an update that sets Role-Based distribution without percentages summing to 100 (closes the pre-existing update() gap)', async () => {
      jest
        .spyOn(merchantTipRuleRepository, 'findOne')
        .mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);

      await expect(
        service.update(
          1,
          {
            tipDistributionMethod: TipDistributionMethod.ROLE_BASED,
            staffPercentage: 0.5,
            kitchenPercentage: 0.3,
            managerPercentage: 0.1,
          },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow('Tip distribution percentages must total 1');
    });

    it('allows a status-only PATCH to succeed even when the persisted percentage-calculation rule has invalid suggestedPercentages (regression: status toggle must not be blocked by pre-existing bad data)', async () => {
      jest.spyOn(merchantTipRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantTipRule,
        tipCalculationMethod: TipCalculationMethod.PERCENTAGE,
        suggestedPercentages: [0.15, 0.18, 0.2],
      } as MerchantTipRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as User);
      jest
        .spyOn(merchantTipRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantTipRule);

      await expect(
        service.update(1, { status: 'inactive' }, mockMerchantAdminUser),
      ).resolves.toBeDefined();
    });

    it('allows a status-only PATCH to succeed even when the persisted role-based rule has invalid distribution percentages (regression: status toggle must not be blocked by pre-existing bad data)', async () => {
      jest.spyOn(merchantTipRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantTipRule,
        tipDistributionMethod: TipDistributionMethod.ROLE_BASED,
        staffPercentage: 0.5,
        kitchenPercentage: 0.3,
        managerPercentage: 0.3,
      } as MerchantTipRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTipRule.company as Company).id,
      } as Merchant);
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValue({ id: 1 } as User);
      jest
        .spyOn(merchantTipRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantTipRule);

      await expect(
        service.update(1, { status: 'active' }, mockMerchantAdminUser),
      ).resolves.toBeDefined();
    });
  });

  describe('Remove Merchant Tip Rule', () => {
    it('should remove a merchant tip rule successfully', async () => {
      const findOneSpy = jest.spyOn(merchantTipRuleRepository, 'findOne');
      const saveSpy = jest.spyOn(merchantTipRuleRepository, 'save');

      findOneSpy.mockResolvedValue(mockMerchantTipRule as MerchantTipRule);
      saveSpy.mockResolvedValue(mockMerchantTipRule as MerchantTipRule);

      const result = await service.remove(1);

      expect(findOneSpy).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
      });
      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Tip Rule deleted successfully',
        data: mockMerchantTipRule,
      });
    });

    it('should throw error for invalid ID during removal', async () => {
      await expect(service.remove(0)).rejects.toThrow();
    });

    it('should throw error when merchant tip rule to remove not found', async () => {
      const findOneSpy = jest.spyOn(merchantTipRuleRepository, 'findOne');
      findOneSpy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(
        'Merchant Tip Rule not found',
      );
      expect(findOneSpy).toHaveBeenCalledWith({
        where: {
          id: 999,
        },
      });
    });
  });

  describe('Repository Integration', () => {
    it('should properly integrate with the merchant tip rule repository', () => {
      expect(merchantTipRuleRepository).toBeDefined();
      expect(typeof merchantTipRuleRepository.find).toBe('function');
      expect(typeof merchantTipRuleRepository.findOne).toBe('function');
      expect(typeof merchantTipRuleRepository.create).toBe('function');
      expect(typeof merchantTipRuleRepository.save).toBe('function');
      expect(typeof merchantTipRuleRepository.remove).toBe('function');
    });
  });
});
