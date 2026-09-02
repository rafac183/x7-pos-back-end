import { Test, TestingModule } from '@nestjs/testing';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Variant } from 'src/inventory/products-inventory/variants/entities/variant.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SupplierInvoiceItemService } from './supplier-invoice-item.service';
import { SupplierInvoiceItem } from './entities/supplier-invoice-item.entity';
import { SupplierInvoice } from '../supplier-invoices/entities/supplier-invoice.entity';
import { Product } from '../../../inventory/products-inventory/products/entities/product.entity';

describe('SupplierInvoiceItemService', () => {
  let service: SupplierInvoiceItemService;

  const itemRepoMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const invoiceRepoMock = { findOne: jest.fn() };
  const productRepoMock = { findOne: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierInvoiceItemService,
        {
          provide: getRepositoryToken(SupplierInvoiceItem),
          useValue: itemRepoMock,
        },
        {
          provide: getRepositoryToken(SupplierInvoice),
          useValue: invoiceRepoMock,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: productRepoMock,
        },
      
        {
          // El servicio ganó esta dependencia y el spec nunca la registró: el módulo
          // de pruebas no compilaba y la suite entera contaba como fallo.
          provide: getRepositoryToken(Variant),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            findBy: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      
        {
          // Dependencia que el servicio ganó y este spec nunca registró.
          provide: getRepositoryToken(Merchant),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            findBy: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SupplierInvoiceItemService>(
      SupplierInvoiceItemService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
