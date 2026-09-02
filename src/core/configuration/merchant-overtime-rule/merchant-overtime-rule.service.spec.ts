//src/core/configuration/merchant-overtime-rule/merchant-overtime-rule.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyStatus } from 'src/platform-saas/companies/constants/company-status.enum';
import { MerchantOvertimeRuleService } from './merchant-overtime-rule.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MerchantOvertimeRule } from './entity/merchant-overtime-rule.entity';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { OvertimeCalculationType } from '../constants/overtime-calculation-type.enum';
import { OvertimeRateType } from '../constants/overtime-rate-type.enum';
import { CreateMerchantOvertimeRuleDto } from './dto/create-merchant-overtime-rule.dto';
import { UpdateMerchantOvertimeRuleDto } from './dto/update-merchant-overtime-rule.dto';
import { SelectQueryBuilder } from 'typeorm';
import { Repository, In } from 'typeorm';
import { User } from 'src/platform-saas/users/entities/user.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';

const OVERTIME_RULE_SELECT_FIELDS = [
  'merchantOvertimeRule',
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

describe('MerchantOvertimeRuleService', () => {
  let service: MerchantOvertimeRuleService;
  let merchantOvertimeRuleRepository: Repository<MerchantOvertimeRule>;
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

  //Mock Data
  const mockMerchantOvertimeRule: Partial<MerchantOvertimeRule> = {
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
    name: 'Test Merchant Overtime Rule',
    description: 'Description of the Overtime Rule',
    calculationMethod: OvertimeCalculationType.DAILY,
    rateMethod: OvertimeRateType.MULTIPLIER,
    thresholdHours: 8,
    maxHours: 10,
    rateValue: 200,
    appliesOnHolidays: true,
    appliesOnWeekends: true,
    priority: 10,
  };

  const mockCreateMerchantOvertimeRuleDto: CreateMerchantOvertimeRuleDto = {
    name: 'Test Merchant Overtime Rule',
    description: 'Description of the Overtime Rule',
    calculationMethod: OvertimeCalculationType.DAILY,
    rateMethod: OvertimeRateType.MULTIPLIER,
    thresholdHours: 8,
    maxHours: 10,
    rateValue: 200,
    appliesOnHolidays: true,
    appliesOnWeekends: true,
    priority: 10,
  };

  const mockUpdateMerchantOvertimeRuleDto: UpdateMerchantOvertimeRuleDto = {
    status: 'inactive',
    name: 'Test Merchant Overtime Rule 2',
    description: 'Description of the Overtime Rule 2',
    calculationMethod: OvertimeCalculationType.HOLIDAY,
    rateMethod: OvertimeRateType.FIXED_AMOUNT,
    appliesOnHolidays: false,
    appliesOnWeekends: false,
    priority: 10,
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
        .mockResolvedValue([[mockMerchantOvertimeRule], 1]),
      getOne: jest.fn().mockResolvedValue(mockMerchantOvertimeRule),
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
        MerchantOvertimeRuleService,
        {
          provide: getRepositoryToken(MerchantOvertimeRule),
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

    service = module.get<MerchantOvertimeRuleService>(
      MerchantOvertimeRuleService,
    );
    merchantOvertimeRuleRepository = module.get<
      Repository<MerchantOvertimeRule>
    >(getRepositoryToken(MerchantOvertimeRule));
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
      expect(merchantOvertimeRuleRepository).toBeDefined();
    });
  });

  describe('Create Merchant Overtime Rule', () => {
    it('should create and return a merchant overtime rule successfully', async () => {
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

      const createSpy = jest.spyOn(merchantOvertimeRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantOvertimeRuleRepository, 'save');

      createSpy.mockReturnValue(mockMerchantOvertimeRule as MerchantOvertimeRule);
      saveSpy.mockResolvedValue(mockMerchantOvertimeRule as MerchantOvertimeRule);

      const result = await service.create(
        mockCreateMerchantOvertimeRuleDto,
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          company: { id: 7 },
          status: 'active',
          thresholdHours: 8,
          maxHours: 10,
        }),
      );
      expect(saveSpy).toHaveBeenCalledWith(mockMerchantOvertimeRule);
      expect(result).toEqual({
        statusCode: 201,
        message: 'Merchant Overtime Rule created successfully',
        data: mockMerchantOvertimeRule,
      });
    });

    it('rejects daily/weekly rules missing thresholdHours or maxHours', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);

      await expect(
        service.create(
          { ...mockCreateMerchantOvertimeRuleDto, thresholdHours: undefined },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow();
    });

    it('forces thresholdHours/maxHours to null for holiday and special_day rules, ignoring client input', async () => {
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

      const createSpy = jest
        .spyOn(merchantOvertimeRuleRepository, 'create')
        .mockReturnValue(mockMerchantOvertimeRule as MerchantOvertimeRule);
      jest
        .spyOn(merchantOvertimeRuleRepository, 'save')
        .mockResolvedValue(mockMerchantOvertimeRule as MerchantOvertimeRule);

      await service.create(
        {
          ...mockCreateMerchantOvertimeRuleDto,
          calculationMethod: OvertimeCalculationType.HOLIDAY,
          thresholdHours: 8,
          maxHours: 10,
        },
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ thresholdHours: null, maxHours: null }),
      );
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

      const createSpy = jest.spyOn(merchantOvertimeRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantOvertimeRuleRepository, 'save');

      createSpy.mockReturnValue(mockMerchantOvertimeRule as MerchantOvertimeRule);
      saveSpy.mockRejectedValue(new Error('Database error'));

      await expect(
        service.create(mockCreateMerchantOvertimeRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Database error');

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ company: { id: 7 } }),
      );
      expect(saveSpy).toHaveBeenCalledWith(mockMerchantOvertimeRule);
    });

    it('throws forbidden when the creating user has no resolvable merchant', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create(mockCreateMerchantOvertimeRuleDto, mockMerchantAdminUser),
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
        .spyOn(merchantOvertimeRuleRepository, 'create')
        .mockReturnValue(mockMerchantOvertimeRule as MerchantOvertimeRule);
      jest
        .spyOn(merchantOvertimeRuleRepository, 'save')
        .mockResolvedValue(mockMerchantOvertimeRule as MerchantOvertimeRule);

      await service.create(mockCreateMerchantOvertimeRuleDto, mockMerchantAdminUser);

      expect(userFindOneSpy).toHaveBeenCalledWith({
        where: { id: 1 },
        select: ['id', 'username', 'email'],
      });
    });
  });

  describe('Find All Merchant Overtime Rules', () => {
    it('should return all merchant overtime rules', async () => {
      const mockMerchantOvertimeRules = [
        mockMerchantOvertimeRule as MerchantOvertimeRule,
      ];

      // QueryBuilder ya mockeado en el beforeEach
      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantOvertimeRule>
      >;

      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([
          mockMerchantOvertimeRules,
          mockMerchantOvertimeRules.length,
        ]);

      const result = await service.findAll(
        {
          page: 1,
          limit: 10,
        },
        mockPortalAdminUser,
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Overtime Rules retrieved successfully',
        data: mockMerchantOvertimeRules,
        pagination: {
          page: 1,
          limit: 10,
          total: mockMerchantOvertimeRules.length,
          totalPages: 1,
        },
      });
    });

    it('should return an empty array when no merchant overtime rule found', async () => {
      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantOvertimeRule>
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
        message: 'Merchant Overtime Rules retrieved successfully',
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
      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantOvertimeRule>
      >;
      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([[mockMerchantOvertimeRule as MerchantOvertimeRule], 1]);
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
      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantOvertimeRule>
      >;
      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([[mockMerchantOvertimeRule as MerchantOvertimeRule], 1]);
      const merchantFindOneSpy = jest.spyOn(merchantRepository, 'findOne');

      await service.findAll({ page: 1, limit: 10 }, mockPortalAdminUser);

      expect(merchantFindOneSpy).not.toHaveBeenCalled();
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'company.id = :companyId',
        expect.anything(),
      );
    });

    it('includes username in the selected audit fields', async () => {
      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as any;
      qb.getManyAndCount.mockResolvedValue([[mockMerchantOvertimeRule], 1]);

      await service.findAll({ page: 1, limit: 10 }, mockPortalAdminUser);

      expect(qb.select).toHaveBeenCalledWith(OVERTIME_RULE_SELECT_FIELDS);
    });
  });

  describe('Find One Merchant Overtime Rule', () => {
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

    it('should handle not found merchant overtime rule', async () => {
      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(null);

      await expect(
        service.findOne(999, mockMerchantAdminUser),
      ).rejects.toThrow('Merchant Overtime Rule not found');
    });

    it('scopes findOne to a safe field list via queryBuilder instead of loading raw relations', async () => {
      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue({
        id: 1,
        company: { id: 7 },
      } as MerchantOvertimeRule);
      const repoFindOneSpy = jest.spyOn(merchantOvertimeRuleRepository, 'findOne');
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);

      await service.findOne(1, mockMerchantAdminUser);

      expect(qb.select).toHaveBeenCalledWith(OVERTIME_RULE_SELECT_FIELDS);
      expect(repoFindOneSpy).not.toHaveBeenCalled();
    });

    it('should return a merchant overtime rule when found', async () => {
      const mockFound = {
        id: 1,
        company: { id: 1 } as Company,
        createdBy: { id: 1 } as User,
        updatedBy: { id: 1 } as User,
        status: 'active',
        name: 'Test Merchant Overtime Rule',
        description: 'Description of the Overtime Rule',
        calculationMethod: OvertimeCalculationType.DAILY,
        rateMethod: OvertimeRateType.MULTIPLIER,
        thresholdHours: 8,
        maxHours: 10,
        rateValue: 200,
        appliesOnHolidays: true,
        appliesOnWeekends: true,
        priority: 10,
      } as MerchantOvertimeRule;

      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(mockFound);

      const result = await service.findOne(1, mockPortalAdminUser);

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Overtime Rule retrieved successfully',
        data: mockFound,
      });
    });

    it('allows a merchant admin to view a rule owned by their own company', async () => {
      const mockFound = {
        id: 1,
        company: { id: 7 } as Company,
        status: 'active',
        name: 'Test Merchant Overtime Rule',
        description: 'Description of the Overtime Rule',
        calculationMethod: OvertimeCalculationType.DAILY,
        rateMethod: OvertimeRateType.MULTIPLIER,
        thresholdHours: 8,
        maxHours: 10,
        rateValue: 200,
        appliesOnHolidays: true,
        appliesOnWeekends: true,
        priority: 10,
      } as MerchantOvertimeRule;
      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(mockFound);
      jest
        .spyOn(merchantRepository, 'findOne')
        .mockResolvedValue({ id: 10, companyId: 7 } as Merchant);

      const result = await service.findOne(1, mockMerchantAdminUser);

      expect(result.data).toEqual(mockFound);
    });

    it('forbids viewing an overtime rule owned by a different company', async () => {
      const mockFound = {
        id: 1,
        company: { id: 7 } as Company,
        status: 'active',
        name: 'Test Merchant Overtime Rule',
        description: 'Description of the Overtime Rule',
        calculationMethod: OvertimeCalculationType.DAILY,
        rateMethod: OvertimeRateType.MULTIPLIER,
        thresholdHours: 8,
        maxHours: 10,
        rateValue: 200,
        appliesOnHolidays: true,
        appliesOnWeekends: true,
        priority: 10,
      } as MerchantOvertimeRule;
      const qb = merchantOvertimeRuleRepository.createQueryBuilder() as any;
      qb.getOne.mockResolvedValue(mockFound);
      jest
        .spyOn(merchantRepository, 'findOne')
        .mockResolvedValue({ id: 10, companyId: 999 } as Merchant);

      await expect(
        service.findOne(1, mockMerchantAdminUser),
      ).rejects.toThrow();
    });
  });

  describe('Update Merchant Overtime Rule', () => {
    it('should update and return a merchant overtime rule successfully', async () => {
      const updatedMerchantOvertimeRule = {
        ...mockMerchantOvertimeRule,
        ...mockUpdateMerchantOvertimeRuleDto,
        company: { id: 7 } as Company,
        createdBy: mockMerchantOvertimeRule.createdBy,
        updatedBy: { id: 1 } as User,
      } as Partial<MerchantOvertimeRule>;

      const findOneSpy = jest
        .spyOn(merchantOvertimeRuleRepository, 'findOne')
        .mockResolvedValue({
          ...mockMerchantOvertimeRule,
          company: { id: 7 },
        } as MerchantOvertimeRule);
      const saveSpy = jest.spyOn(merchantOvertimeRuleRepository, 'save');

      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);
      jest
        .spyOn(merchantRepository, 'findOne')
        .mockResolvedValue({ id: 10, companyId: 7 } as Merchant);

      saveSpy.mockResolvedValue(updatedMerchantOvertimeRule as MerchantOvertimeRule);

      const result = await service.update(
        1,
        mockUpdateMerchantOvertimeRuleDto,
        mockMerchantAdminUser,
      );

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: 1, status: In(['active', 'inactive']) },
        relations: ['company', 'merchant'],
      });
      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Overtime Rule updated successfully',
        data: updatedMerchantOvertimeRule,
      });
    });

    it('always sets updatedBy and updatedAt from the session user, ignoring any client value', async () => {
      const originalUpdatedAt = new Date('2020-01-01T00:00:00.000Z');
      jest.spyOn(merchantOvertimeRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantOvertimeRule,
        company: { id: 7 },
        updatedAt: originalUpdatedAt,
        updatedBy: { id: 99 } as User,
      } as MerchantOvertimeRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      const sessionUser = { id: 1 } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(sessionUser);
      const saveSpy = jest
        .spyOn(merchantOvertimeRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantOvertimeRule);

      await service.update(1, mockUpdateMerchantOvertimeRuleDto, mockMerchantAdminUser);

      const savedEntity = saveSpy.mock.calls[0][0] as MerchantOvertimeRule;
      expect(savedEntity.updatedBy).toEqual(sessionUser);
      expect(savedEntity.updatedAt.getTime()).not.toBe(originalUpdatedAt.getTime());
    });

    it('forbids updating an overtime rule owned by a different company', async () => {
      jest.spyOn(merchantOvertimeRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantOvertimeRule,
        company: { id: 7 },
      } as MerchantOvertimeRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 999,
      } as Merchant);

      await expect(
        service.update(1, mockUpdateMerchantOvertimeRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should throw error for invalid ID during update', async () => {
      await expect(
        service.update(0, mockUpdateMerchantOvertimeRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should throw error when merchant overtime rule to update not found', async () => {
      const findOneSpy = jest.spyOn(merchantOvertimeRuleRepository, 'findOne');
      findOneSpy.mockResolvedValue(null);

      await expect(
        service.update(999, mockUpdateMerchantOvertimeRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Merchant Overtime Rule not found');
      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: 999, status: In(['active', 'inactive']) },
        relations: ['company', 'merchant'],
      });
    });

    it('should handle database errors during update', async () => {
      jest.spyOn(merchantOvertimeRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantOvertimeRule,
        company: { id: 7 },
      } as MerchantOvertimeRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({ id: 1 } as User);
      const saveSpy = jest.spyOn(merchantOvertimeRuleRepository, 'save');
      saveSpy.mockRejectedValue(new Error('Database error'));

      await expect(
        service.update(1, mockUpdateMerchantOvertimeRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Database error');
    });
  });

  describe('Remove Merchant Overtime Rule', () => {
    it('should remove a merchant overtime rule successfully', async () => {
      const findOneSpy = jest.spyOn(merchantOvertimeRuleRepository, 'findOne');
      const saveSpy = jest.spyOn(merchantOvertimeRuleRepository, 'save');

      findOneSpy.mockResolvedValue(
        mockMerchantOvertimeRule as MerchantOvertimeRule,
      );
      saveSpy.mockResolvedValue(
        mockMerchantOvertimeRule as MerchantOvertimeRule,
      );

      const result = await service.remove(1);

      expect(findOneSpy).toHaveBeenCalledWith({
        where: {
          id: 1,
        },
      });
      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Overtime Rule deleted successfully',
        data: mockMerchantOvertimeRule,
      });
    });

    it('should throw error for invalid ID during removal', async () => {
      await expect(service.remove(0)).rejects.toThrow();
    });

    it('should throw error when merchant overtime rule to remove not found', async () => {
      const findOneSpy = jest.spyOn(merchantOvertimeRuleRepository, 'findOne');
      findOneSpy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(
        'Merchant Overtime Rule not found',
      );
      expect(findOneSpy).toHaveBeenCalledWith({
        where: {
          id: 999,
        },
      });
    });
  });

  describe('Repository Integration', () => {
    it('should properly integrate with the merchant overtime rule repository', () => {
      expect(merchantOvertimeRuleRepository).toBeDefined();
      expect(typeof merchantOvertimeRuleRepository.find).toBe('function');
      expect(typeof merchantOvertimeRuleRepository.findOne).toBe('function');
      expect(typeof merchantOvertimeRuleRepository.create).toBe('function');
      expect(typeof merchantOvertimeRuleRepository.save).toBe('function');
      expect(typeof merchantOvertimeRuleRepository.remove).toBe('function');
    });
  });
});
