import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { SupplierInvoicesController } from './supplier-invoices.controller';
import { SupplierInvoicesService } from './supplier-invoices.service';
import { SupplierInvoiceInventoryService } from 'src/inventory/supplier-invoice-inventory/supplier-invoice-inventory.service';
import { SCOPES_KEY } from 'src/auth/decorators/scopes.decorator';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import type { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

describe('SupplierInvoicesController', () => {
  /** El controlador recibe el usuario con @CurrentUser en TODOS sus endpoints. */
  const mockCurrentUser: AuthenticatedUser = {
    id: 1,
    email: 'a@b.c',
    role: UserRole.MERCHANT_ADMIN,
    scope: Scope.MERCHANT_WEB,
    merchant: { id: 9, companyId: 3 },
  };

  let controller: SupplierInvoicesController;

  const mockSupplierInvoicesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockSupplierInvoiceInventoryService = {
    receiveForInvoice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupplierInvoicesController],
      providers: [
        {
          provide: SupplierInvoicesService,
          useValue: mockSupplierInvoicesService,
        },
        {
          provide: SupplierInvoiceInventoryService,
          useValue: mockSupplierInvoiceInventoryService,
        },
      ],
    }).compile();

    controller = module.get<SupplierInvoicesController>(
      SupplierInvoicesController,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with dto', async () => {
      const dto = {
        company_id: 1,
        supplier_id: 1,
        invoice_number: 'INV-001',
        invoice_date: '2025-03-01',
        due_date: '2025-03-31',
        subtotal: 1000,
        total_amount: 1190,
      };
      mockSupplierInvoicesService.create.mockResolvedValue({
        statusCode: 201,
        message: 'Supplier invoice created successfully',
        data: { id: 1, ...dto },
      });
      await controller.create(dto, mockCurrentUser);
      expect(mockSupplierInvoicesService.create).toHaveBeenCalledWith(dto, 3);
    });
  });

  describe('receiveInventory', () => {
    it('is restricted to MERCHANT_WEB scope only', () => {
      const reflector = new Reflector();
      const scopes = reflector.get<Scope[]>(
        SCOPES_KEY,
        SupplierInvoicesController.prototype.receiveInventory,
      );
      expect(scopes).toEqual([Scope.MERCHANT_WEB]);
    });

    it('delegates to SupplierInvoiceInventoryService', async () => {
      mockSupplierInvoiceInventoryService.receiveForInvoice.mockResolvedValue({
        invoiceId: 3,
        locationId: 5,
        lines: [],
      });
      const user: AuthenticatedUser = {
        id: 1,
        email: 'a@b.c',
        role: UserRole.MERCHANT_ADMIN,
        scope: Scope.MERCHANT_WEB,
        merchant: { id: 9 },
      };
      await controller.receiveInventory(3, {}, user);
      expect(
        mockSupplierInvoiceInventoryService.receiveForInvoice,
      ).toHaveBeenCalledWith(9, 3, undefined);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with query', async () => {
      const query = { page: 1, limit: 10 };
      mockSupplierInvoicesService.findAll.mockResolvedValue({
        statusCode: 200,
        data: [],
        paginationMeta: {},
      });
      await controller.findAll(query, mockCurrentUser);
      expect(mockSupplierInvoicesService.findAll).toHaveBeenCalledWith(query, 3);
    });
  });
});
