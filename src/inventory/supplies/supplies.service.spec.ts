import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuppliesService } from './supplies.service';
import { Supply } from './entities/supply.entity';
import { SupplySupplier } from './entities/supply-supplier.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Supplier } from 'src/core/business-partners/suppliers/entities/supplier.entity';
import { RawMaterialCategory } from './categories/entities/raw-material-category.entity';
import { ProductRecipeLine } from 'src/inventory/products-inventory/recipes/entities/product-recipe-line.entity';
import { Movement } from 'src/inventory/products-inventory/stocks/movements/entities/movement.entity';
import { SupplyUnit } from './constants/supply-unit.enum';

describe('SuppliesService', () => {
  let service: SuppliesService;
  let merchantRepo: jest.Mocked<Repository<Merchant>>;
  let supplierRepo: jest.Mocked<Repository<Supplier>>;
  let supplyRepo: jest.Mocked<Repository<Supply>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliesService,
        {
          provide: getRepositoryToken(Supply),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SupplySupplier),
          useValue: {
            delete: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Supplier),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RawMaterialCategory),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ProductRecipeLine),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Movement),
          useValue: {
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SuppliesService);
    merchantRepo = module.get(getRepositoryToken(Merchant));
    supplierRepo = module.get(getRepositoryToken(Supplier));
    supplyRepo = module.get(getRepositoryToken(Supply));
    jest.clearAllMocks();
  });

  it('should reject when merchant is not associated with a company', async () => {
    jest.spyOn(merchantRepo, 'findOne').mockResolvedValue({
      id: 1,
      companyId: 0,
    } as Merchant);
    await expect(
      service.create(1, { code: 'X', name: 'X', unit: SupplyUnit.UNIT }),
    ).rejects.toThrow('Merchant is not associated with a company');
  });

  it('should enforce unique supply code per company', async () => {
    jest.spyOn(merchantRepo, 'findOne').mockResolvedValue({
      id: 1,
      companyId: 10,
    } as Merchant);
    jest.spyOn(supplyRepo, 'findOne').mockResolvedValue({
      id: 1,
      company_id: 10,
      code: 'X',
    } as Supply);

    await expect(
      service.create(1, { code: 'X', name: 'X', unit: SupplyUnit.UNIT }),
    ).rejects.toThrow('Raw material code/SKU already exists for this company');
  });

  it('should reject supplier association when suppliers are outside the company', async () => {
    jest.spyOn(merchantRepo, 'findOne').mockResolvedValue({
      id: 1,
      companyId: 10,
    } as Merchant);
    jest.spyOn(supplyRepo, 'findOne').mockResolvedValue({
      id: 1,
      company_id: 10,
      isActive: true,
    } as Supply);
    jest
      .spyOn(supplierRepo, 'find')
      .mockResolvedValue([
        { id: 1, company_id: 10, isActive: true } as Supplier,
      ]);

    await expect(service.setSuppliers(1, 1, [1, 2])).rejects.toThrow(
      'One or more suppliers were not found for this company',
    );
  });
});
