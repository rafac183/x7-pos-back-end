import { Test, TestingModule } from '@nestjs/testing';
import { StockLevelMonitorService } from 'src/inventory/stock-alerts/stock-level-monitor.service';
import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SupplierInvoiceInventoryService } from './supplier-invoice-inventory.service';
import { RecipeTheoreticalCostService } from '../products-inventory/recipes/recipe-theoretical-cost.service';
import { SupplierInvoiceStatus } from 'src/finance-hr/account-payable/supplier-invoices/constants/supplier-invoice-status.enum';

describe('SupplierInvoiceInventoryService', () => {
  let service: SupplierInvoiceInventoryService;

  const mockRecipeCost = {
    computeBaseTheoreticalCostCached: jest.fn().mockResolvedValue('1.0000'),
  };

  const mockQueryRunner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    manager: {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_entity: unknown, data: object) => data),
      save: jest.fn((_entity: unknown, data: object) =>
        Promise.resolve({ id: 99, ...data }),
      ),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
    manager: {
      findOne: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierInvoiceInventoryService,
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: RecipeTheoreticalCostService,
          useValue: mockRecipeCost,
        },
      
        {
          // Dependencia que el servicio ganó y este spec nunca registró.
          provide: StockLevelMonitorService,
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
    service = module.get(SupplierInvoiceInventoryService);
  });

  it('rejects when inventory was already received', async () => {
    mockDataSource.manager.findOne.mockImplementation(
      (entity: { name?: string }) => {
        if (entity.name === 'Merchant') {
          return Promise.resolve({
            id: 1,
            companyId: 10,
            defaultSalesStockLocationId: 5,
          });
        }
        if (entity.name === 'Location') {
          return Promise.resolve({ id: 5, merchantId: 1, isActive: true });
        }
        return Promise.resolve(null);
      },
    );

    mockQueryRunner.manager.findOne.mockResolvedValue({
      id: 7,
      company_id: 10,
      status: SupplierInvoiceStatus.PENDING,
      inventory_received_at: new Date(),
      invoice_number: 'INV-1',
      items: [],
    });

    await expect(service.receiveForInvoice(1, 7)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });
});
