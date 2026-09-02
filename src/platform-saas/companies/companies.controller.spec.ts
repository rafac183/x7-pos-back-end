// src/platform-saas/companies/companies.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompanyStatus } from 'src/platform-saas/companies/constants/company-status.enum';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dtos/create-company.dto';
import { UpdateCompanyDto } from './dtos/update-company.dto';
import {
  OneCompanyResponseDto,
  AllCompanyResponseDto,
} from './dtos/company-response.dto';
import { UserRole } from '../users/constants/role.enum';
import { Scope } from '../users/constants/scope.enum';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

describe('CompaniesController', () => {
  let controller: CompaniesController;
  let companiesService: jest.Mocked<CompaniesService>;

  const mockUser: AuthenticatedUser = {
    id: 1,
    email: 'admin@test.com',
    role: UserRole.MERCHANT_ADMIN,
    scope: Scope.MERCHANT_WEB,
    merchant: { id: 1 },
  };

  // Mock data
  const mockCompany = {
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
  };

  const mockCreateCompanyDto: CreateCompanyDto = {
    name: 'New Company',
    email: 'new@company.com',
    phone: '9876543210',
    rut: '98765432-1',
    address: '456 New St',
    city: 'New City',
    state: 'New State',
    country: 'New Country',
  };

  const mockUpdateCompanyDto: UpdateCompanyDto = {
    name: 'Updated Company',
    email: 'updated@company.com',
  };

  const mockOneCompanyResponse: OneCompanyResponseDto = {
    statusCode: 200,
    message: 'Company retrieved successfully',
    data: mockCompany,
  };

  const mockAllCompaniesResponse: AllCompanyResponseDto = {
    statusCode: 200,
    message: 'Companies retrieved successfully',
    data: [mockCompany],
  };

  beforeEach(async () => {
    // Mock CompaniesService
    const mockCompaniesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      getProfileForUser: jest.fn(),
      updateProfileForUser: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [
        {
          provide: CompaniesService,
          useValue: mockCompaniesService,
        },
      ],
    }).compile();

    controller = module.get<CompaniesController>(CompaniesController);
    companiesService = module.get(CompaniesService);
  });

  describe('Controller Initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have companiesService defined', () => {
      expect(companiesService).toBeDefined();
    });
  });

  describe('POST /companies (create)', () => {
    it('should create a new company successfully', async () => {
      const createResponse: OneCompanyResponseDto = {
        statusCode: 201,
        message: 'Company created successfully',
        data: mockCompany,
      };

      const createSpy = jest.spyOn(companiesService, 'create');
      createSpy.mockResolvedValue(createResponse);

      const result = await controller.create(mockCreateCompanyDto);

      expect(createSpy).toHaveBeenCalledWith(mockCreateCompanyDto);
      expect(result).toEqual(createResponse);
    });

    it('should handle service errors during creation', async () => {
      const errorMessage = 'Database operation failed';
      const createSpy = jest.spyOn(companiesService, 'create');
      createSpy.mockRejectedValue(new Error(errorMessage));

      await expect(controller.create(mockCreateCompanyDto)).rejects.toThrow(
        errorMessage,
      );
      expect(createSpy).toHaveBeenCalledWith(mockCreateCompanyDto);
    });

    it('should handle validation errors during creation', async () => {
      const errorMessage = 'Invalid input data provided';
      const createSpy = jest.spyOn(companiesService, 'create');
      createSpy.mockRejectedValue(new Error(errorMessage));

      await expect(controller.create(mockCreateCompanyDto)).rejects.toThrow(
        errorMessage,
      );
      expect(createSpy).toHaveBeenCalledWith(mockCreateCompanyDto);
    });
  });

  describe('GET /companies (findAll)', () => {
    it('should return all companies successfully', async () => {
      const findAllSpy = jest.spyOn(companiesService, 'findAll');
      findAllSpy.mockResolvedValue(mockAllCompaniesResponse);

      const result = await controller.findAll();

      expect(findAllSpy).toHaveBeenCalled();
      expect(result).toEqual(mockAllCompaniesResponse);
    });

    it('should handle empty company list', async () => {
      const emptyResponse: AllCompanyResponseDto = {
        statusCode: 200,
        message: 'Companies retrieved successfully',
        data: [],
      };
      const findAllSpy = jest.spyOn(companiesService, 'findAll');
      findAllSpy.mockResolvedValue(emptyResponse);

      const result = await controller.findAll();

      expect(findAllSpy).toHaveBeenCalled();
      expect(result).toEqual(emptyResponse);
      expect(result.data).toHaveLength(0);
    });

    it('should handle service errors in findAll', async () => {
      const errorMessage = 'Database connection failed';
      const findAllSpy = jest.spyOn(companiesService, 'findAll');
      findAllSpy.mockRejectedValue(new Error(errorMessage));

      await expect(controller.findAll()).rejects.toThrow(errorMessage);
      expect(findAllSpy).toHaveBeenCalled();
    });
  });

  describe('GET /companies/:id (findOne)', () => {
    it('should return a company by ID successfully', async () => {
      const companyId = 1;
      const findOneSpy = jest.spyOn(companiesService, 'findOne');
      findOneSpy.mockResolvedValue(mockOneCompanyResponse);

      const result = await controller.findOne(companyId, mockUser);

      expect(findOneSpy).toHaveBeenCalledWith(companyId, mockUser);
      expect(result).toEqual(mockOneCompanyResponse);
    });

    it('should handle company not found', async () => {
      const companyId = 999;
      const errorMessage = 'Company not found';
      const findOneSpy = jest.spyOn(companiesService, 'findOne');
      findOneSpy.mockRejectedValue(new Error(errorMessage));

      await expect(controller.findOne(companyId, mockUser)).rejects.toThrow(errorMessage);
      expect(findOneSpy).toHaveBeenCalledWith(companyId, mockUser);
    });

    it('should handle invalid ID parameter', async () => {
      const companyId = 0;
      const errorMessage = 'Invalid ID parameter';
      const findOneSpy = jest.spyOn(companiesService, 'findOne');
      findOneSpy.mockRejectedValue(new Error(errorMessage));

      await expect(controller.findOne(companyId, mockUser)).rejects.toThrow(errorMessage);
      expect(findOneSpy).toHaveBeenCalledWith(companyId, mockUser);
    });
  });

  describe('PUT /companies/:id (update)', () => {
    it('should update company successfully', async () => {
      const companyId = 1;
      const updatedCompanyResponse: OneCompanyResponseDto = {
        statusCode: 200,
        message: 'Company updated successfully',
        data: { ...mockCompany, ...mockUpdateCompanyDto },
      };

      const updateSpy = jest.spyOn(companiesService, 'update');
      updateSpy.mockResolvedValue(updatedCompanyResponse);

      const result = await controller.update(companyId, mockUpdateCompanyDto, mockUser);

      expect(updateSpy).toHaveBeenCalledWith(companyId, mockUpdateCompanyDto, mockUser);
      expect(result).toEqual(updatedCompanyResponse);
    });

    it('should handle update company not found', async () => {
      const companyId = 999;
      const errorMessage = 'Company not found';

      const updateSpy = jest.spyOn(companiesService, 'update');
      updateSpy.mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.update(companyId, mockUpdateCompanyDto, mockUser),
      ).rejects.toThrow(errorMessage);
      expect(updateSpy).toHaveBeenCalledWith(companyId, mockUpdateCompanyDto, mockUser);
    });

    it('should handle validation errors during update', async () => {
      const companyId = 1;
      const errorMessage = 'Invalid input data provided';

      const updateSpy = jest.spyOn(companiesService, 'update');
      updateSpy.mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.update(companyId, mockUpdateCompanyDto, mockUser),
      ).rejects.toThrow(errorMessage);
      expect(updateSpy).toHaveBeenCalledWith(companyId, mockUpdateCompanyDto, mockUser);
    });

    it('should handle invalid ID during update', async () => {
      const companyId = 0;
      const errorMessage = 'Invalid ID parameter';

      const updateSpy = jest.spyOn(companiesService, 'update');
      updateSpy.mockRejectedValue(new Error(errorMessage));

      await expect(
        controller.update(companyId, mockUpdateCompanyDto, mockUser),
      ).rejects.toThrow(errorMessage);
      expect(updateSpy).toHaveBeenCalledWith(companyId, mockUpdateCompanyDto, mockUser);
    });
  });

  describe('DELETE /companies/:id (remove)', () => {
    it('should delete company successfully', async () => {
      const companyId = 1;
      const deleteResponse: OneCompanyResponseDto = {
        statusCode: 200,
        message: 'Company deleted successfully',
        data: mockCompany,
      };

      const removeSpy = jest.spyOn(companiesService, 'remove');
      removeSpy.mockResolvedValue(deleteResponse);

      const result = await controller.remove(companyId, mockUser);

      expect(removeSpy).toHaveBeenCalledWith(companyId, mockUser);
      expect(result).toEqual(deleteResponse);
    });

    it('should handle delete company not found', async () => {
      const companyId = 999;
      const errorMessage = 'Company not found';

      const removeSpy = jest.spyOn(companiesService, 'remove');
      removeSpy.mockRejectedValue(new Error(errorMessage));

      await expect(controller.remove(companyId, mockUser)).rejects.toThrow(errorMessage);
      expect(removeSpy).toHaveBeenCalledWith(companyId, mockUser);
    });

    it('should handle invalid ID during deletion', async () => {
      const companyId = 0;
      const errorMessage = 'Invalid ID parameter';

      const removeSpy = jest.spyOn(companiesService, 'remove');
      removeSpy.mockRejectedValue(new Error(errorMessage));

      await expect(controller.remove(companyId, mockUser)).rejects.toThrow(errorMessage);
      expect(removeSpy).toHaveBeenCalledWith(companyId, mockUser);
    });
  });

  describe('Service Integration', () => {
    it('should properly integrate with CompaniesService', () => {
      expect(controller['companiesService']).toBe(companiesService);
    });

    it('should call service methods with correct parameters', async () => {
      // Test that controller passes parameters correctly to service
      const createSpy = jest.spyOn(companiesService, 'create');
      const findAllSpy = jest.spyOn(companiesService, 'findAll');
      const findOneSpy = jest.spyOn(companiesService, 'findOne');
      const updateSpy = jest.spyOn(companiesService, 'update');
      const removeSpy = jest.spyOn(companiesService, 'remove');

      await controller.create(mockCreateCompanyDto);
      await controller.findAll();
      await controller.findOne(1, mockUser);
      await controller.update(1, mockUpdateCompanyDto, mockUser);
      await controller.remove(1, mockUser);

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(findAllSpy).toHaveBeenCalledTimes(1);
      expect(findOneSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle all service method calls appropriately', async () => {
      // Mock all service methods to return appropriate responses
      const createSpy = jest.spyOn(companiesService, 'create');
      const findAllSpy = jest.spyOn(companiesService, 'findAll');
      const findOneSpy = jest.spyOn(companiesService, 'findOne');
      const updateSpy = jest.spyOn(companiesService, 'update');
      const removeSpy = jest.spyOn(companiesService, 'remove');

      createSpy.mockResolvedValue({
        statusCode: 201,
        message: 'Company created successfully',
        data: mockCompany,
      });
      findAllSpy.mockResolvedValue(mockAllCompaniesResponse);
      findOneSpy.mockResolvedValue(mockOneCompanyResponse);
      updateSpy.mockResolvedValue({
        statusCode: 200,
        message: 'Company updated successfully',
        data: mockCompany,
      });
      removeSpy.mockResolvedValue({
        statusCode: 200,
        message: 'Company deleted successfully',
        data: mockCompany,
      });

      // Call all controller methods
      const createResult = await controller.create(mockCreateCompanyDto);
      const findAllResult = await controller.findAll();
      const findOneResult = await controller.findOne(1, mockUser);
      const updateResult = await controller.update(1, mockUpdateCompanyDto, mockUser);
      const removeResult = await controller.remove(1, mockUser);

      // Verify all calls were made and returned expected results
      expect(createResult.statusCode).toBe(201);
      expect(findAllResult.statusCode).toBe(200);
      expect(findOneResult.statusCode).toBe(200);
      expect(updateResult.statusCode).toBe(200);
      expect(removeResult.statusCode).toBe(200);
    });
  });
});
