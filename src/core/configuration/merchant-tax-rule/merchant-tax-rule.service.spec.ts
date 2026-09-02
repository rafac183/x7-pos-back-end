//src/core/configuration/merchant-tax-rule/merchant-tax-rule.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyStatus } from 'src/platform-saas/companies/constants/company-status.enum';
import { MerchantTaxRuleService } from './merchant-tax-rule.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MerchantTaxRule } from './entity/merchant-tax-rule.entity';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { TaxType } from '../constants/tax-type.enum';
import { CreateMerchantTaxRuleDto } from './dto/create-merchant-tax-rule.dto';
import { UpdateMerchantTaxRuleDto } from './dto/update-merchant-tax-rule.dto';
import { SelectQueryBuilder } from 'typeorm';
import { Repository, In } from 'typeorm';
import { User } from 'src/platform-saas/users/entities/user.entity';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';

describe('MerchantTaxRuleService', () => {
  let service: MerchantTaxRuleService;
  let merchantTaxRuleRepository: Repository<MerchantTaxRule>;
  let companyRepository: Repository<Company>;
  let merchantRepository: Repository<Merchant>;
  let userRepository: Repository<User>;

  const mockMerchantTaxRule: Partial<MerchantTaxRule> = {
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
    createdBy: {
      id: 1,
      username: 'admin',
      email: 'merchant-admin@test.com',
    } as User,
    updatedBy: {
      id: 1,
      username: 'admin',
      email: 'merchant-admin@test.com',
    } as User,
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

  const mockCreateMerchantTaxRuleDto: CreateMerchantTaxRuleDto = {
    name: 'Test Merchant Tax Rule',
    description: 'Description of the merchant tax rule',
    taxType: TaxType.COMPOUND,
    rate: 0.19,
    appliesToTips: true,
    appliesToOvertime: true,
    externalTaxCode: 'lfgtr-hhse',
  };

  const mockUpdateMerchantTaxRuleDto: UpdateMerchantTaxRuleDto = {
    status: 'inactive',
    name: 'Update Merchant Tax Rule',
    description: 'Description of the merchant tax rule',
    taxType: TaxType.COMPOUND,
    rate: 0.19,
    appliesToTips: true,
    appliesToOvertime: true,
    externalTaxCode: 'lfgtr-hhse',
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
      getManyAndCount: jest.fn().mockResolvedValue([[mockMerchantTaxRule], 1]),
      getOne: jest.fn().mockResolvedValue(mockMerchantTaxRule),
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
        MerchantTaxRuleService,
        {
          provide: getRepositoryToken(MerchantTaxRule),
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
          provide: getRepositoryToken(Merchant),
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
      ],
    }).compile();

    service = module.get<MerchantTaxRuleService>(MerchantTaxRuleService);
    merchantTaxRuleRepository = module.get<Repository<MerchantTaxRule>>(
      getRepositoryToken(MerchantTaxRule),
    );
    companyRepository = module.get<Repository<Company>>(
      getRepositoryToken(Company),
    );
    merchantRepository = module.get<Repository<Merchant>>(
      getRepositoryToken(Merchant),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
    it('repository should be defined', () => {
      expect(merchantTaxRuleRepository).toBeDefined();
    });
  });

  describe('Create Merchant Tax Rule', () => {
    it('should create and return a merchant tax rule successfully', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);
      jest.spyOn(companyRepository, 'findOne').mockResolvedValue({
        id: 7,
      } as Company);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
        username: 'admin',
        email: 'merchant-admin@test.com',
      } as User);

      const createSpy = jest.spyOn(merchantTaxRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantTaxRuleRepository, 'save');

      createSpy.mockReturnValue(mockMerchantTaxRule as MerchantTaxRule);
      saveSpy.mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);

      const result = await service.create(
        mockCreateMerchantTaxRuleDto,
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          company: { id: 7 },
          merchant: { id: 10, companyId: 7 },
          status: 'active',
          isCompound: true,
        }),
      );
      expect(saveSpy).toHaveBeenCalledWith(mockMerchantTaxRule);
      expect(result).toEqual({
        statusCode: 201,
        message: 'Merchant Tax Rule created successfully',
        data: mockMerchantTaxRule,
      });
    });

    it('derives isCompound=false for a non-compound tax type', async () => {
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

      const createSpy = jest.spyOn(merchantTaxRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantTaxRuleRepository, 'save');
      createSpy.mockReturnValue(mockMerchantTaxRule as MerchantTaxRule);
      saveSpy.mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);

      await service.create(
        { ...mockCreateMerchantTaxRuleDto, taxType: TaxType.PERCENTAGE },
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isCompound: false }),
      );
    });

    it('throws forbidden when the creating user has no resolvable merchant', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.create(mockCreateMerchantTaxRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('rejects a rate greater than 10 for a percentage tax type', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);

      await expect(
        service.create(
          {
            ...mockCreateMerchantTaxRuleDto,
            taxType: TaxType.PERCENTAGE,
            rate: 19,
          },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow(
        'For PERCENTAGE/COMPOUND tax types, rate must be a decimal fraction (e.g. 0.19 for 19%), not a whole percentage number.',
      );
    });

    it('rejects a rate greater than 10 for a compound tax type', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);

      await expect(
        service.create(
          {
            ...mockCreateMerchantTaxRuleDto,
            taxType: TaxType.COMPOUND,
            rate: 15,
          },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow(
        'For PERCENTAGE/COMPOUND tax types, rate must be a decimal fraction (e.g. 0.19 for 19%), not a whole percentage number.',
      );
    });

    it('rejects a rate greater than 1 for a percentage tax type', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);

      await expect(
        service.create(
          {
            ...mockCreateMerchantTaxRuleDto,
            taxType: TaxType.PERCENTAGE,
            rate: 1.9,
          },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow(
        'For PERCENTAGE/COMPOUND tax types, rate must be a decimal fraction (e.g. 0.19 for 19%), not a whole percentage number.',
      );
    });

    it('rejects a rate greater than 1 for a compound tax type', async () => {
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 7,
      } as Merchant);

      await expect(
        service.create(
          {
            ...mockCreateMerchantTaxRuleDto,
            taxType: TaxType.COMPOUND,
            rate: 1.9,
          },
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow(
        'For PERCENTAGE/COMPOUND tax types, rate must be a decimal fraction (e.g. 0.19 for 19%), not a whole percentage number.',
      );
    });

    it('allows a rate of exactly 1 for a percentage tax type', async () => {
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

      const createSpy = jest.spyOn(merchantTaxRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantTaxRuleRepository, 'save');
      createSpy.mockReturnValue(mockMerchantTaxRule as MerchantTaxRule);
      saveSpy.mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);

      await service.create(
        { ...mockCreateMerchantTaxRuleDto, taxType: TaxType.PERCENTAGE, rate: 1 },
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ rate: 1, taxType: TaxType.PERCENTAGE }),
      );
    });

    it('allows a rate greater than 10 for a fixed tax type', async () => {
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

      const createSpy = jest.spyOn(merchantTaxRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantTaxRuleRepository, 'save');
      createSpy.mockReturnValue(mockMerchantTaxRule as MerchantTaxRule);
      saveSpy.mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);

      await service.create(
        { ...mockCreateMerchantTaxRuleDto, taxType: TaxType.FIXED, rate: 15 },
        mockMerchantAdminUser,
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ rate: 15, taxType: TaxType.FIXED }),
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

      const createSpy = jest.spyOn(merchantTaxRuleRepository, 'create');
      const saveSpy = jest.spyOn(merchantTaxRuleRepository, 'save');

      createSpy.mockReturnValue(mockMerchantTaxRule as MerchantTaxRule);
      saveSpy.mockRejectedValue(new Error('Database error'));

      await expect(
        service.create(mockCreateMerchantTaxRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Database error');
    });
  });

  describe('Find All Merchant Tax Rules', () => {
    it('should return all merchant tax rules', async () => {
      const mockMerchantTaxRules = [mockMerchantTaxRule as MerchantTaxRule];

      const qb = merchantTaxRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTaxRule>
      >;

      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([mockMerchantTaxRules, mockMerchantTaxRules.length]);

      const result = await service.findAll(
        { page: 1, limit: 10 },
        mockPortalAdminUser,
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Tax Rules retrieved successfully',
        data: mockMerchantTaxRules,
        pagination: {
          page: 1,
          limit: 10,
          total: mockMerchantTaxRules.length,
          totalPages: 1,
        },
      });
    });

    it('should return an empty array when no merchant tax rule found', async () => {
      const qb = merchantTaxRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTaxRule>
      >;

      jest.spyOn(qb, 'getManyAndCount').mockResolvedValue([[], 0]);

      const result = await service.findAll(
        { page: 1, limit: 10 },
        mockPortalAdminUser,
      );

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Tax Rules retrieved successfully',
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
      const qb = merchantTaxRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTaxRule>
      >;
      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([[mockMerchantTaxRule as MerchantTaxRule], 1]);
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
      const qb = merchantTaxRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTaxRule>
      >;
      jest
        .spyOn(qb, 'getManyAndCount')
        .mockResolvedValue([[mockMerchantTaxRule as MerchantTaxRule], 1]);
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
  });

  describe('Find One Merchant Tax Rule', () => {
    it('should throw error for invalid ID (null)', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await expect(
        service.findOne(null as any, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should throw error for invalid ID (zero)', async () => {
      await expect(service.findOne(0, mockMerchantAdminUser)).rejects.toThrow();
    });

    it('should throw error for invalid ID (negative)', async () => {
      await expect(
        service.findOne(-1, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should handle not found merchant tax rule', async () => {
      const qb = merchantTaxRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTaxRule>
      >;
      jest.spyOn(qb, 'getOne').mockResolvedValue(null);

      await expect(service.findOne(999, mockMerchantAdminUser)).rejects.toThrow(
        'Merchant Tax Rule not found',
      );
    });

    it('should return a merchant tax rule when found and owned by the caller', async () => {
      const qb = merchantTaxRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTaxRule>
      >;
      jest
        .spyOn(qb, 'getOne')
        .mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: (mockMerchantTaxRule.company as Company).id,
      } as Merchant);

      const result = await service.findOne(1, mockMerchantAdminUser);

      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Tax Rule retrieved successfully',
        data: mockMerchantTaxRule,
      });
    });

    it('forbids viewing a tax rule owned by a different company', async () => {
      const qb = merchantTaxRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTaxRule>
      >;
      jest
        .spyOn(qb, 'getOne')
        .mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 999,
      } as Merchant);

      await expect(service.findOne(1, mockMerchantAdminUser)).rejects.toThrow();
    });

    it('does not restrict a portal admin by company', async () => {
      const qb = merchantTaxRuleRepository.createQueryBuilder() as Partial<
        SelectQueryBuilder<MerchantTaxRule>
      >;
      jest
        .spyOn(qb, 'getOne')
        .mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);
      const merchantFindOneSpy = jest.spyOn(merchantRepository, 'findOne');

      const result = await service.findOne(1, mockPortalAdminUser);

      expect(merchantFindOneSpy).not.toHaveBeenCalled();
      expect(result.data).toEqual(mockMerchantTaxRule);
    });
  });

  describe('Update Merchant Tax Rule', () => {
    it('should update and return a merchant tax rule successfully', async () => {
      const findOneSpy = jest.spyOn(merchantTaxRuleRepository, 'findOne');
      const saveSpy = jest.spyOn(merchantTaxRuleRepository, 'save');

      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 1,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
        username: 'admin',
        email: 'merchant-admin@test.com',
      } as User);

      findOneSpy.mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);
      saveSpy.mockImplementation(async (entity) => entity as MerchantTaxRule);

      const result = await service.update(
        1,
        mockUpdateMerchantTaxRuleDto,
        mockMerchantAdminUser,
      );

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: 1, status: In(['active', 'inactive']) },
        relations: ['company', 'merchant'],
      });
      expect(saveSpy).toHaveBeenCalled();
      expect(result.statusCode).toBe(200);
      expect(result.data.name).toBe(mockUpdateMerchantTaxRuleDto.name);
      expect(result.data.status).toBe('inactive');
    });

    it('recomputes isCompound when taxType changes', async () => {
      jest.spyOn(merchantTaxRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantTaxRule,
        isCompound: true,
      } as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 1,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);
      const saveSpy = jest
        .spyOn(merchantTaxRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantTaxRule);

      await service.update(
        1,
        { taxType: TaxType.PERCENTAGE },
        mockMerchantAdminUser,
      );

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isCompound: false }),
      );
    });

    it('leaves isCompound untouched when taxType is not in the payload', async () => {
      jest.spyOn(merchantTaxRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantTaxRule,
        isCompound: true,
      } as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 1,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);
      const saveSpy = jest
        .spyOn(merchantTaxRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantTaxRule);

      await service.update(1, { rate: 0.25 }, mockMerchantAdminUser);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ isCompound: true }),
      );
    });

    it('rejects a rate greater than 10 when the existing tax type is compound', async () => {
      jest.spyOn(merchantTaxRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantTaxRule,
        taxType: TaxType.COMPOUND,
      } as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 1,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);

      await expect(
        service.update(1, { rate: 19 }, mockMerchantAdminUser),
      ).rejects.toThrow(
        'For PERCENTAGE/COMPOUND tax types, rate must be a decimal fraction (e.g. 0.19 for 19%), not a whole percentage number.',
      );
    });

    it('rejects a rate greater than 1 when the existing tax type is compound', async () => {
      jest.spyOn(merchantTaxRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantTaxRule,
        taxType: TaxType.COMPOUND,
      } as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 1,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);

      await expect(
        service.update(1, { rate: 1.9 }, mockMerchantAdminUser),
      ).rejects.toThrow(
        'For PERCENTAGE/COMPOUND tax types, rate must be a decimal fraction (e.g. 0.19 for 19%), not a whole percentage number.',
      );
    });

    it('allows a rate greater than 10 when changing tax type to fixed', async () => {
      jest.spyOn(merchantTaxRuleRepository, 'findOne').mockResolvedValue({
        ...mockMerchantTaxRule,
        taxType: TaxType.COMPOUND,
      } as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 1,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);
      const saveSpy = jest
        .spyOn(merchantTaxRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantTaxRule);

      await service.update(
        1,
        { taxType: TaxType.FIXED, rate: 15 },
        mockMerchantAdminUser,
      );

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ rate: 15, taxType: TaxType.FIXED }),
      );
    });

    it('forbids updating a tax rule owned by a different company', async () => {
      jest
        .spyOn(merchantTaxRuleRepository, 'findOne')
        .mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 999,
      } as Merchant);

      await expect(
        service.update(1, mockUpdateMerchantTaxRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('does not restrict a portal admin by company', async () => {
      jest
        .spyOn(merchantTaxRuleRepository, 'findOne')
        .mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);
      const merchantFindOneSpy = jest.spyOn(merchantRepository, 'findOne');
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 2,
      } as User);
      jest
        .spyOn(merchantTaxRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantTaxRule);

      await service.update(
        1,
        mockUpdateMerchantTaxRuleDto,
        mockPortalAdminUser,
      );

      expect(merchantFindOneSpy).not.toHaveBeenCalled();
    });

    it('always sets updatedBy from the session user, ignoring any client value', async () => {
      jest
        .spyOn(merchantTaxRuleRepository, 'findOne')
        .mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 1,
      } as Merchant);
      const sessionUser = { id: 1, username: 'session-user' } as User;
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(sessionUser);
      const saveSpy = jest
        .spyOn(merchantTaxRuleRepository, 'save')
        .mockImplementation(async (entity) => entity as MerchantTaxRule);

      await service.update(
        1,
        mockUpdateMerchantTaxRuleDto,
        mockMerchantAdminUser,
      );

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ updatedBy: sessionUser }),
      );
    });

    it('should throw error for invalid ID during update', async () => {
      await expect(
        service.update(0, mockUpdateMerchantTaxRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow();
    });

    it('should throw error when merchant tax rule to update not found', async () => {
      const findOneSpy = jest.spyOn(merchantTaxRuleRepository, 'findOne');
      findOneSpy.mockResolvedValue(null);

      await expect(
        service.update(
          999,
          mockUpdateMerchantTaxRuleDto,
          mockMerchantAdminUser,
        ),
      ).rejects.toThrow('Merchant Tax Rule not found');
    });

    it('should handle database errors during update', async () => {
      jest
        .spyOn(merchantTaxRuleRepository, 'findOne')
        .mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);
      jest.spyOn(merchantRepository, 'findOne').mockResolvedValue({
        id: 10,
        companyId: 1,
      } as Merchant);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        id: 1,
      } as User);
      jest
        .spyOn(merchantTaxRuleRepository, 'save')
        .mockRejectedValue(new Error('Database error'));

      await expect(
        service.update(1, mockUpdateMerchantTaxRuleDto, mockMerchantAdminUser),
      ).rejects.toThrow('Database error');
    });
  });

  describe('Remove Merchant Tax Rule', () => {
    it('should remove a merchant tax rule successfully', async () => {
      const findOneSpy = jest.spyOn(merchantTaxRuleRepository, 'findOne');
      const saveSpy = jest.spyOn(merchantTaxRuleRepository, 'save');

      findOneSpy.mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);
      saveSpy.mockResolvedValue(mockMerchantTaxRule as MerchantTaxRule);

      const result = await service.remove(1);

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(saveSpy).toHaveBeenCalled();
      expect(result).toEqual({
        statusCode: 200,
        message: 'Merchant Tax Rule deleted successfully',
        data: mockMerchantTaxRule,
      });
    });

    it('should throw error for invalid ID during removal', async () => {
      await expect(service.remove(0)).rejects.toThrow();
    });

    it('should throw error when merchant tax rule to remove not found', async () => {
      const findOneSpy = jest.spyOn(merchantTaxRuleRepository, 'findOne');
      findOneSpy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(
        'Merchant Tax Rule not found',
      );
      expect(findOneSpy).toHaveBeenCalledWith({
        where: { id: 999 },
      });
    });
  });

  describe('Repository Integration', () => {
    it('should properly integrate with the merchant tax rule repository', () => {
      expect(merchantTaxRuleRepository).toBeDefined();
      expect(typeof merchantTaxRuleRepository.find).toBe('function');
      expect(typeof merchantTaxRuleRepository.findOne).toBe('function');
      expect(typeof merchantTaxRuleRepository.create).toBe('function');
      expect(typeof merchantTaxRuleRepository.save).toBe('function');
      expect(typeof merchantTaxRuleRepository.remove).toBe('function');
    });
  });
});
