// src/platform-saas/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from 'src/mail/mail.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Company } from '../companies/entities/company.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { UserRole } from './constants/role.enum';
import { Scope } from './constants/scope.enum';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let companyRepository: jest.Mocked<Repository<Company>>;
  let merchantRepository: jest.Mocked<Repository<Merchant>>;

  // Mock data
  const mockMerchant: Partial<Merchant> = {
    id: 1,
    name: 'Test Merchant',
    email: 'merchant@test.com',
  };

  const mockUser: Partial<User> = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: UserRole.MERCHANT_ADMIN,
    scope: Scope.MERCHANT_WEB,
    merchantId: 1,
    merchant: mockMerchant as Merchant,
  };

  beforeEach(async () => {
    const mockUserRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const mockCompanyRepository = {
      findOne: jest.fn(),
    };

    const mockMerchantRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Company),
          useValue: mockCompanyRepository,
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: mockMerchantRepository,
        },
      
        {
          // Dependencia que el servicio ganó y este spec nunca registró.
          provide: MailService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    companyRepository = module.get(getRepositoryToken(Company));
    merchantRepository = module.get(getRepositoryToken(Merchant));

    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have userRepository defined', () => {
      expect(userRepository).toBeDefined();
    });

    it('should have companyRepository defined', () => {
      expect(companyRepository).toBeDefined();
    });

    it('should have merchantRepository defined', () => {
      expect(merchantRepository).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all users successfully', async () => {
      const users = [mockUser as User];
      const findSpy = jest.spyOn(userRepository, 'find');
      findSpy.mockResolvedValue(users);

      const result = await service.findAll();

      expect(findSpy).toHaveBeenCalledWith({
        relations: ['merchant'],
      });
      expect(result).toEqual({
        statusCode: 200,
        message: 'Users retrieved successfully',
        data: [
          {
            id: mockUser.id,
            username: mockUser.username,
            email: mockUser.email,
            role: mockUser.role,
            scope: mockUser.scope,
            merchantId: mockUser.merchantId,
            merchant: mockUser.merchant,
          },
        ],
      });
    });

    it('should return empty array when no users found', async () => {
      userRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result.data).toEqual([]);
      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Users retrieved successfully');
    });
  });

  describe('findById', () => {
    it('should return a user by ID', async () => {
      const findOneBySpy = jest.spyOn(userRepository, 'findOneBy');
      findOneBySpy.mockResolvedValue(mockUser as User);

      const result = await service.findById(1);

      expect(findOneBySpy).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      const findOneBySpy = jest.spyOn(userRepository, 'findOneBy');
      findOneBySpy.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(findOneBySpy).toHaveBeenCalledWith({ id: 999 });
      expect(result).toBeNull();
    });
  });

  describe('Repository Methods', () => {
    it('should call findByResetToken with correct parameters', async () => {
      const findOneSpy = jest.spyOn(userRepository, 'findOne');
      findOneSpy.mockResolvedValue(mockUser as User);

      const result = await service.findByResetToken('reset-token');

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { resetToken: 'reset-token' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should call findByRefreshToken with correct parameters', async () => {
      const findOneSpy = jest.spyOn(userRepository, 'findOne');
      findOneSpy.mockResolvedValue(mockUser as User);

      const result = await service.findByRefreshToken('refresh-token');

      expect(findOneSpy).toHaveBeenCalledWith({
        where: { refreshToken: 'refresh-token' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should save reset token correctly', async () => {
      const updateSpy = jest.spyOn(userRepository, 'update');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      updateSpy.mockResolvedValue({ affected: 1 } as any);

      await service.saveResetToken(1, 'reset-token-123');

      expect(updateSpy).toHaveBeenCalledWith(1, {
        resetToken: 'reset-token-123',
      });
    });

    it('should update password correctly', async () => {
      const updateSpy = jest.spyOn(userRepository, 'update');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      updateSpy.mockResolvedValue({ affected: 1 } as any);

      await service.updatePassword(1, 'newHashedPassword');

      expect(updateSpy).toHaveBeenCalledWith(1, {
        password: 'newHashedPassword',
        resetToken: null,
      });
    });

    it('should save refresh token correctly', async () => {
      const updateSpy = jest.spyOn(userRepository, 'update');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      updateSpy.mockResolvedValue({ affected: 1 } as any);

      await service.saveRefreshToken(1, 'refresh-token-abc');

      expect(updateSpy).toHaveBeenCalledWith(1, {
        refreshToken: 'refresh-token-abc',
      });
    });

    it('should update refresh token correctly', async () => {
      const updateSpy = jest.spyOn(userRepository, 'update');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      updateSpy.mockResolvedValue({ affected: 1 } as any);

      await service.updateRefreshToken(1, 'new-refresh-token');

      expect(updateSpy).toHaveBeenCalledWith(1, {
        refreshToken: 'new-refresh-token',
      });
    });
  });

  describe('Entity Relationships', () => {
    it('should call companyRepository when needed', () => {
      expect(companyRepository).toBeDefined();
      expect(typeof companyRepository.findOne).toBe('function');
    });

    it('should call merchantRepository when needed', () => {
      expect(merchantRepository).toBeDefined();
      expect(typeof merchantRepository.findOne).toBe('function');
    });
  });
});
