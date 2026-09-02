//src/core/configuration/merchant-payroll-rule/merchant-payroll-rule.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyStatus } from 'src/platform-saas/companies/constants/company-status.enum';
import { MerchantPayrollRuleService } from './merchant-payroll-rule.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MerchantPayrollRule } from './entity/merchant-payroll-rule.entity';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { PayrollFrequency } from '../constants/payroll-frequency.enum';
import { CreateMerchantPayrollRuleDto } from './dto/create-merchant-payroll-rule.dto';
import { UpdateMerchantPayrollRuleDto } from './dto/update-merchant-payroll-rule.dto';
import { SelectQueryBuilder } from 'typeorm';
import { Repository, In } from 'typeorm';
import { User } from 'src/platform-saas/users/entities/user.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';

const PAYROLL_RULE_SELECT_FIELDS = [
  'merchantPayrollRule',
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

describe('MerchantPayrollRuleService', () => {
  let service: MerchantPayrollRuleService;
  let merchantPayrollRuleRepository: Repository<MerchantPayrollRule>;
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

  const mockMerchantPayrollRule: Partial<MerchantPayrollRule> = {
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
      suppliers: [],
      merchants: [],
      customers: [],
      configurations: [],
    } as Company,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: 1 } as User,
    updatedBy: { id: 1 } as User,
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
    frequencyPayroll: PayrollFrequency.BIWEEKLY,
    payDayOfWeek: 4,
    payDayOfMonth: 29,
    allowNegativePayroll: false,
    roundingPrecision: 2,
    currency: 'USD',
    autoApprovePayroll: false,
    requiresManagerApproval: true,
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
      getManyAndCount: jest
        .fn()
        .mockResolvedValue([[mockMerchantPayrollRule], 1]),
      getOne: jest.fn().mockResolvedValue(mockMerchantPayrollRule),
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
        MerchantPayrollRuleService,
        {
          provide: getRepositoryToken(MerchantPayrollRule),
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

    service = module.get<MerchantPayrollRuleService>(
      MerchantPayrollRuleService,
    );
    merchantPayrollRuleRepository = module.get<
      Repository<MerchantPayrollRule>
    >(getRepositoryToken(MerchantPayrollRule));
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
      expect(merchantPayrollRuleRepository).toBeDefined();
    });
  });

  describe('Create Merchant Payroll Rule', () => {
    it('should create and return a merchant payroll rule successfully', async () => {
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

      const createSpy = jest.spyOn(merchantPayrollRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantPayrollRuleRepository, 'save');

      createSpy.mockReturnValue(mockMerchantPayrollRule as MerchantPayrollRule);
      saveSpy.mockResolvedValue(mockMerchantPayrollRule as MerchantPayrollRule);

      const result = await service.create(
        mockCreateMerchantPayrollRuleDto,
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ company: { id: 7 }, status: 'active' }),
      );
      expect(saveSpy).toHaveBeenCalledWith(mockMerchantPayrollRule);
      expect(result).toEqual({
        statusCode: 201,
        message: 'Merchant Payroll Rule created successfully',
        data: mockMerchantPayrollRule,
      });
    });

    it('throws forbidden when the creating user has no resolvable merchant', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create(mockCreateMerchantPayrollRuleDto, mockMerchantAdminUser),
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
        .spyOn(merchantPayrollRuleRepository, 'create')
        .mockReturnValue(mockMerchantPayrollRule as MerchantPayrollRule);
      jest
        .spyOn(merchantPayrollRuleRepository, 'save')
        .mockResolvedValue(mockMerchantPayrollRule as MerchantPayrollRule);

      await service.create(mockCreateMerchantPayrollRuleDto, mockMerchantAdminUser);

      expect(userFindOneSpy).toHaveBeenCalledWith({
        where: { id: 1 },
        select: ['id', 'username', 'email'],
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

      const createSpy = jest.spyOn(merchantPayrollRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantPayrollRuleRepository, 'save');

      createSpy.mockReturnValue(mockMerchantPayrollRule as MerchantPayrollRule);
      saveSpy.mockRejectedValue(new Error('Database error'));

      await expect(
        service.create(mockCreateMerchantPayrollRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Database error');
    });

    it('rejects weekly/biweekly rules missing payDayOfWeek', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({ id: 7 } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);

      await expect(
        service.create(
          {
            ...mockCreateMerchantPayrollRuleDto,
            frequencyPayroll: PayrollFrequency.WEEKLY,
            payDayOfWeek: undefined,
          },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow();
    });

    it('rejects monthly rules missing payDayOfMonth', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({ id: 7 } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);

      await expect(
        service.create(
          {
            ...mockCreateMerchantPayrollRuleDto,
            frequencyPayroll: PayrollFrequency.MONTHLY,
            payDayOfMonth: undefined,
          },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow();
    });

    it('forces payDayOfMonth to null for weekly/biweekly rules, ignoring client input', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({ id: 7 } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);
      const createSpy = jest
        .spyOn(merchantPayrollRuleRepository, 'create')
        .mockReturnValue(mockMerchantPayrollRule as MerchantPayrollRule);
      jest
        .spyOn(merchantPayrollRuleRepository, 'save')
        .mockResolvedValue(mockMerchantPayrollRule as MerchantPayrollRule);

      await service.create(
        {
          ...mockCreateMerchantPayrollRuleDto,
          frequencyPayroll: PayrollFrequency.BIWEEKLY,
          payDayOfWeek: 3,
          payDayOfMonth: 15,
        },
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ payDayOfWeek: 3, payDayOfMonth: null }),
      );
    });

    it('forces payDayOfWeek to null for monthly rules, ignoring client input', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({ id: 7 } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);
      const createSpy = jest
        .spyOn(merchantPayrollRuleRepository, 'create')
        .mockReturnValue(mockMerchantPayrollRule as MerchantPayrollRule);
      jest
        .spyOn(merchantPayrollRuleRepository, 'save')
        .mockResolvedValue(mockMerchantPayrollRule as MerchantPayrollRule);

      await service.create(
        {
          ...mockCreateMerchantPayrollRuleDto,
          frequencyPayroll: PayrollFrequency.MONTHLY,
          payDayOfWeek: 5,
          payDayOfMonth: 20,
        },
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ payDayOfWeek: null, payDayOfMonth: 20 }),
      );
    });

    it('forces both day fields to null for custom-frequency rules, ignoring client input', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({ id: 7 } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);
      const createSpy = jest
        .spyOn(merchantPayrollRuleRepository, 'create')
        .mockReturnValue(mockMerchantPayrollRule as MerchantPayrollRule);
      jest
        .spyOn(merchantPayrollRuleRepository, 'save')
        .mockResolvedValue(mockMerchantPayrollRule as MerchantPayrollRule);

      await service.create(
        {
          ...mockCreateMerchantPayrollRuleDto,
          frequencyPayroll: PayrollFrequency.CUSTOM,
          payDayOfWeek: 3,
          payDayOfMonth: 15,
        },
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ payDayOfWeek: null, payDayOfMonth: null }),
      );
    });
  });

  describe('Find All Merchant Payroll Rules', () => {
    it('should return all merchant payroll rules', async () => {
      const mockRules = [mockMerchantPayrollRule as MerchantPayrollRule];
      const qb = merchantPayrollRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantPayrollRule>
      >;
      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([mockRules, mockRules.length]);

      const result = await service.findAll(
        { page: 1, limit: 10 },
        mockPortalAdminUser,
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Payroll Rules retrieved successfully',
        data: mockRules,
        pagination: { page: 1, limit: 10, total: mockRules.length, totalPages: 1 },
      });
    });

    it('should return an empty array when no merchant payroll rule found', async () => {
      const qb = merchantPayrollRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantPayrollRule>
      >;
      jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);

      const result = await service.findAll(
        { page: 1, limit: 10 },
        mockPortalAdminUser,
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Payroll Rules retrieved successfully',
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
    });

    it("scopes the query to the merchant admin's company", async () => {
      const qb = merchantPayrollRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantPayrollRule>
      >;
      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([[mockMerchantPayrollRule as MerchantPayrollRule], 1]);
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
      const qb = merchantPayrollRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantPayrollRule>
      >;
      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([[mockMerchantPayrollRule as MerchantPayrollRule], 1]);
      const merchantFindOneSpy = jest.spyOn(merchantRepository, 'findOne');

      await service.findAll({ page: 1, limit: 10 }, mockPortalAdminUser);

      expect(merchantFindOneSpy).not.toHaveBeenCalled();
    });

    it('includes username in the selected audit fields', async () => {
      const qb = merchantPayrollRuleRepository.createQueryBuilder() as any;
      qb.getManyAndCount.mockResolvedValue([[mockMerchantPayrollRule], 1]);

      await service.findAll({ page: 1, limit: 10 }, mockPortalAdminUser);

      expect(qb.select).toHaveBeenCalledWith(PAYROLL_RULE_SELECT_FIELDS);
    });
  });

  describe('Find One Merchant Payroll Rule', () => {
    it('should throw error for invalid ID (null)', async () => {
      await expect(
        service.findOne(null as any, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should throw error for invalid ID (zero)', async () => {
      await expect(service.findOne(0, mockMerchantAdminUser)).rejects.toThrow();
    });

    it('should handle not found merchant payroll rule', async () => {
      const qb = merchantPayrollRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(null);

      await expect(
        service.findOne(999, mockMerchantAdminUser),
      ).rejects.toThrow('Merchant Payroll Rule not found');
    });

    it('scopes findOne to a safe field list via queryBuilder instead of loading raw relations', async () => {
      const qb = merchantPayrollRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue({ id: 1, company: { id: 7 } } as MerchantPayrollRule);
      const repoFindOneSpy = jest.spyOn(merchantPayrollRuleRepository, 'findOne');
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);

      await service.findOne(1, mockMerchantAdminUser);

      expect(qb.select).toHaveBeenCalledWith(PAYROLL_RULE_SELECT_FIELDS);
      expect(repoFindOneSpy).not.toHaveBeenCalled();
    });

    it('allows a merchant admin to view a rule owned by their own company', async () => {
      const mockFound = { ...mockMerchantPayrollRule, id: 1, company: { id: 7 } as Company } as MerchantPayrollRule;
      const qb = merchantPayrollRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(mockFound);
      jest
        .spyOn(merchantRepository, 'findOne')
        .mockResolvedValue({ id: 10, companyId: 7 } as Merchant);

      const result = await service.findOne(1, mockMerchantAdminUser);

      expect(result.data).toEqual(mockFound);
    });

    it('forbids viewing a payroll rule owned by a different company', async () => {
      const mockFound = { ...mockMerchantPayrollRule, id: 1, company: { id: 7 } as Company } as MerchantPayrollRule;
      const qb = merchantPayrollRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(mockFound);
      jest
        .spyOn(merchantRepository, 'findOne')
        .mockResolvedValue({ id: 10, companyId: 999 } as Merchant);

      await expect(
        service.findOne(1, mockMerchantAdminUser),
      ).rejects.toThrow();
    });
  });

  describe('Update Merchant Payroll Rule', () => {
    it('should update and return a merchant payroll rule successfully', async () => {
      const updated = {
        ...mockMerchantPayrollRule,
        ...mockUpdateMerchantPayrollRuleDto,
        company: { id: 7 } as Company,
        updatedBy: { id: 1 } as User,
      } as Partial<MerchantPayrollRule>;

      jest.spyOn(merchantPayrollRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantPayrollRule,
        company: { id: 7 },
      } as MerchantPayrollRule);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);
      jest
        .spyOn(merchantRepository, 'findOne')
        .mockResolvedValue({ id: 10, companyId: 7 } as Merchant);
      const saveSpy = jest
        .spyOn(merchantPayrollRuleRepository, 'save')
        .mockResolvedValue(updated as MerchantPayrollRule);

      const result = await service.update(1, mockUpdateMerchantPayrollRuleDto, mockMerchantAdminUser);

      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Payroll Rule updated successfully',
        data: updated,
      });
    });

    it('always sets updatedBy and updatedAt from the session user, ignoring any client value', async () => {
      const originalUpdatedAt = new Date('2020-01-01T00:00:00.000Z');
      jest.spyOn(merchantPayrollRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantPayrollRule,
        company: { id: 7 },
        updatedAt: originalUpdatedAt,
        updatedBy: { id: 99 } as User,
      } as MerchantPayrollRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      const sessionUser = { id: 1 } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(sessionUser);
      const saveSpy = jest
        .spyOn(merchantPayrollRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantPayrollRule);

      await service.update(1, mockUpdateMerchantPayrollRuleDto, mockMerchantAdminUser);

      const savedEntity = saveSpy.mock.calls[0][0] as MerchantPayrollRule;
      expect(savedEntity.updatedBy).toEqual(sessionUser);
      expect(savedEntity.updatedAt.getTime()).not.toBe(originalUpdatedAt.getTime());
    });

    it('forbids updating a payroll rule owned by a different company', async () => {
      jest.spyOn(merchantPayrollRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantPayrollRule,
        company: { id: 7 },
      } as MerchantPayrollRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 999,
      } as Merchant);

      await expect(
        service.update(1, mockUpdateMerchantPayrollRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should throw error when merchant payroll rule to update not found', async () => {
      jest.spyOn(merchantPayrollRuleRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.update(999, mockUpdateMerchantPayrollRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Merchant Payroll Rule not found');
    });

    it('nulls out the stale payDayOfWeek when the frequency changes from biweekly to custom', async () => {
      jest.spyOn(merchantPayrollRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantPayrollRule,
        company: { id: 7 },
        frequencyPayroll: PayrollFrequency.BIWEEKLY,
        payDayOfWeek: 3,
        payDayOfMonth: null,
      } as unknown as MerchantPayrollRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);
      const saveSpy = jest
        .spyOn(merchantPayrollRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantPayrollRule);

      await service.update(
        1,
        { frequencyPayroll: PayrollFrequency.CUSTOM },
        mockMerchantAdminUser,
      );

      const savedEntity = saveSpy.mock.calls[0][0] as MerchantPayrollRule;
      expect(savedEntity.payDayOfWeek).toBeNull();
      expect(savedEntity.payDayOfMonth).toBeNull();
    });

    it('rejects switching to monthly without a valid payDayOfMonth in the same patch', async () => {
      jest.spyOn(merchantPayrollRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantPayrollRule,
        company: { id: 7 },
        frequencyPayroll: PayrollFrequency.BIWEEKLY,
        payDayOfWeek: 3,
        payDayOfMonth: null,
      } as unknown as MerchantPayrollRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);

      await expect(
        service.update(
          1,
          { frequencyPayroll: PayrollFrequency.MONTHLY },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow();
    });

    it('leaves existing day values untouched when editing an unrelated field', async () => {
      jest.spyOn(merchantPayrollRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantPayrollRule,
        company: { id: 7 },
        frequencyPayroll: PayrollFrequency.BIWEEKLY,
        payDayOfWeek: 3,
        payDayOfMonth: null,
      } as unknown as MerchantPayrollRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);
      const saveSpy = jest
        .spyOn(merchantPayrollRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantPayrollRule);

      await service.update(1, { currency: 'EUR' }, mockMerchantAdminUser);

      const savedEntity = saveSpy.mock.calls[0][0] as MerchantPayrollRule;
      expect(savedEntity.payDayOfWeek).toBe(3);
      expect(savedEntity.payDayOfMonth).toBeNull();
      expect(savedEntity.currency).toBe('EUR');
    });
  });

  describe('Remove Merchant Payroll Rule (unchanged, out of scope)', () => {
    it('should remove a merchant payroll rule successfully', async () => {
      jest
        .spyOn(merchantPayrollRuleRepository, 'findOne')
        .mockResolvedValue(mockMerchantPayrollRule as MerchantPayrollRule);
      const saveSpy = jest
        .spyOn(merchantPayrollRuleRepository, 'save')
        .mockResolvedValue(mockMerchantPayrollRule as MerchantPayrollRule);

      const result = await service.remove(1);

      expect(saveSpy).toHaveBeenCalled();
      expect(result.message).toBe('Merchant Payroll Rule deleted successfully');
    });

    it('should throw error when merchant payroll rule to remove not found', async () => {
      jest.spyOn(merchantPayrollRuleRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow('Merchant Payroll Rule not found');
    });
  });
});
