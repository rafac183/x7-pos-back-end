import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Supply } from './entities/supply.entity';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import {
  FilterRawMaterialDto,
  RawMaterialStatusFilter,
} from './dto/filter-raw-material.dto';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Supplier } from 'src/core/business-partners/suppliers/entities/supplier.entity';
import { SupplySupplier } from './entities/supply-supplier.entity';
import { RawMaterialCategory } from './categories/entities/raw-material-category.entity';
import { ProductRecipeLine } from 'src/inventory/products-inventory/recipes/entities/product-recipe-line.entity';
import { Movement } from 'src/inventory/products-inventory/stocks/movements/entities/movement.entity';
import { Item } from 'src/inventory/products-inventory/stocks/items/entities/item.entity';
import { Location } from 'src/inventory/products-inventory/stocks/locations/entities/location.entity';


@Injectable()
export class SuppliesService {
  constructor(
    @InjectRepository(Supply)
    private readonly supplyRepo: Repository<Supply>,
    @InjectRepository(SupplySupplier)
    private readonly supplySupplierRepo: Repository<SupplySupplier>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(RawMaterialCategory)
    private readonly categoryRepo: Repository<RawMaterialCategory>,
    @InjectRepository(ProductRecipeLine)
    private readonly recipeLineRepo: Repository<ProductRecipeLine>,
    @InjectRepository(Movement)
    private readonly movementRepo: Repository<Movement>,
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
  ) {}

  async getCompanyIdByMerchantId(merchantId: number): Promise<number> {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
      select: ['companyId'],
    });
    if (!merchant?.companyId) {
      throw new BadRequestException(
        'Merchant is not associated with a company',
      );
    }
    return merchant.companyId;
  }

  async create(merchantId: number, dto: CreateSupplyDto): Promise<Supply> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);

    const codeToUse =
      dto.code ??
      dto.sku ??
      `RM-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        Math.random() * 1000,
      )}`;

    const existing = await this.supplyRepo.findOne({
      where: { company_id: companyId, code: codeToUse },
    });
    if (existing) {
      throw new ConflictException(
        'Raw material code/SKU already exists for this company',
      );
    }

    if (dto.category_id) {
      const category = await this.categoryRepo.findOne({
        where: { id: dto.category_id, company_id: companyId, isActive: true },
      });
      if (!category) {
        throw new BadRequestException(
          `Raw material category ${dto.category_id} not found or inactive`,
        );
      }
    }

    const supply = this.supplyRepo.create({
      company_id: companyId,
      code: codeToUse,
      sku: dto.sku ?? dto.code ?? null,
      name: dto.name,
      category_id: dto.category_id ?? null,
      unit: dto.unit,
      purchase_unit: dto.purchase_unit ?? null,
      consumption_unit: dto.consumption_unit ?? null,
      conversion_factor: dto.conversion_factor ?? 1,
      cost_per_unit: dto.cost_per_unit ?? null,
      description: dto.description ?? null,
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    } as Partial<Supply>);

    const savedSupply = await this.supplyRepo.save(supply);

    // Auto-provision initial stock_item for this raw material in ALL active locations of the merchant
    try {
      const locations = await this.locationRepo.find({
        where: { merchantId, isActive: true },
      });
      for (const location of locations) {
        let stockItem = await this.itemRepo.findOne({
          where: { supplyId: savedSupply.id, locationId: location.id },
        });
        if (!stockItem) {
          stockItem = this.itemRepo.create({
            locationId: location.id,
            supplyId: savedSupply.id,
            currentQty: 0,
            minimumQty: 5,
            weightedAverageUnitCost: savedSupply.cost_per_unit ? savedSupply.cost_per_unit.toString() : '0.0000',
            isActive: true,
          });
          await this.itemRepo.save(stockItem);
        }
      }
    } catch (e) {
      console.warn('Failed to auto-provision stock_item for supply across locations:', savedSupply.id, e);
    }


    return savedSupply;
  }


  async findAllPaginated(
    merchantId: number,
    filter: FilterRawMaterialDto,
  ): Promise<{
    items: Supply[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;

    const qb = this.supplyRepo
      .createQueryBuilder('supply')
      .leftJoinAndSelect('supply.category', 'category')
      .where('supply.company_id = :companyId', { companyId });

    if (filter.category_id) {
      qb.andWhere('supply.category_id = :categoryId', {
        categoryId: filter.category_id,
      });
    }

    if (filter.status === RawMaterialStatusFilter.ACTIVE) {
      qb.andWhere('supply.isActive = :isActive', { isActive: true });
    } else if (filter.status === RawMaterialStatusFilter.INACTIVE) {
      qb.andWhere('supply.isActive = :isActive', { isActive: false });
    }

    if (filter.search && filter.search.trim() !== '') {
      const searchTerm = `%${filter.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(supply.name) LIKE :search OR LOWER(supply.code) LIKE :search OR LOWER(supply.sku) LIKE :search)',
        { search: searchTerm },
      );
    }

    qb.orderBy('supply.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findAll(merchantId: number): Promise<Supply[]> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);
    return await this.supplyRepo.find({
      where: { company_id: companyId, isActive: true },
      relations: ['category'],
      order: { id: 'DESC' },
    });
  }

  async findOne(merchantId: number, id: number): Promise<Supply> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);
    const supply = await this.supplyRepo.findOne({
      where: { id, company_id: companyId },
      relations: ['category', 'suppliers', 'suppliers.supplier'],
    });
    if (!supply) throw new NotFoundException('Raw material not found');
    return supply;
  }

  async update(
    merchantId: number,
    id: number,
    dto: UpdateSupplyDto,
  ): Promise<Supply> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);
    const supply = await this.supplyRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!supply) throw new NotFoundException('Raw material not found');

    if (dto.code && dto.code !== supply.code) {
      const existing = await this.supplyRepo.findOne({
        where: { company_id: companyId, code: dto.code },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Raw material code/SKU already exists for this company',
        );
      }
      supply.code = dto.code;
    }

    if (dto.sku !== undefined) supply.sku = dto.sku;
    if (dto.name !== undefined) supply.name = dto.name;
    if (dto.category_id !== undefined) {
      if (dto.category_id !== null) {
        const category = await this.categoryRepo.findOne({
          where: { id: dto.category_id, company_id: companyId, isActive: true },
        });
        if (!category) {
          throw new BadRequestException(
            `Raw material category ${dto.category_id} not found or inactive`,
          );
        }
      }
      supply.category_id = dto.category_id;
    }

    if (dto.unit !== undefined) supply.unit = dto.unit;
    if (dto.purchase_unit !== undefined)
      supply.purchase_unit = dto.purchase_unit;
    if (dto.consumption_unit !== undefined)
      supply.consumption_unit = dto.consumption_unit;
    if (dto.conversion_factor !== undefined)
      supply.conversion_factor = dto.conversion_factor;
    if (dto.cost_per_unit !== undefined)
      supply.cost_per_unit = dto.cost_per_unit;
    if (dto.description !== undefined)
      supply.description = dto.description ?? null;
    if (dto.isActive !== undefined)
      supply.isActive = dto.isActive;

    if (dto.minimumQty !== undefined) {
      await this.itemRepo.update(
        { supplyId: id },
        { minimumQty: dto.minimumQty },
      );
    }

    return await this.supplyRepo.save(supply);
  }


  async remove(
    merchantId: number,
    id: number,
  ): Promise<{ statusCode: 200; message: string }> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);
    const supply = await this.supplyRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!supply) throw new NotFoundException('Raw material not found');

    // Check if referenced in active recipes
    const recipeLineCount = await this.recipeLineRepo.count({
      where: { supplyProductId: id },
    });
    if (recipeLineCount > 0) {
      throw new BadRequestException(
        'Cannot delete raw material referenced in active recipes',
      );
    }

    // Check if referenced in stock movements
    const movementCount = await this.movementRepo.count({
      where: { stockItemId: id },
    });
    if (movementCount > 0) {
      throw new BadRequestException(
        'Cannot delete raw material referenced in stock movements',
      );
    }

    supply.isActive = false;
    await this.supplyRepo.save(supply);
    return { statusCode: 200, message: 'Raw material soft-deleted successfully' };
  }

  async setSuppliers(
    merchantId: number,
    supplyId: number,
    supplierIds: number[],
  ): Promise<Supply> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);

    const supply = await this.supplyRepo.findOne({
      where: { id: supplyId, company_id: companyId },
    });
    if (!supply) throw new NotFoundException('Raw material not found');

    const suppliers = await this.supplierRepo.find({
      where: { id: In(supplierIds), company_id: companyId, isActive: true },
    });
    if (suppliers.length !== supplierIds.length) {
      throw new BadRequestException(
        'One or more suppliers were not found for this company',
      );
    }

    // Replace existing associations.
    await this.supplySupplierRepo.delete({ supply: { id: supplyId } as Supply });

    const rows = suppliers.map((s) =>
      this.supplySupplierRepo.create({
        supply: { id: supplyId } as Supply,
        supplier: { id: s.id } as Supplier,
      } as Partial<SupplySupplier>),
    );
    if (rows.length) {
      await this.supplySupplierRepo.save(rows);
    }
    return await this.findOne(merchantId, supplyId);
  }

  async checkUsage(
    merchantId: number,
    id: number,
  ): Promise<{ inRecipes: boolean; inMovements: boolean }> {
    const companyId = await this.getCompanyIdByMerchantId(merchantId);
    const supply = await this.supplyRepo.findOne({
      where: { id, company_id: companyId },
    });
    if (!supply) throw new NotFoundException('Raw material not found');

    const recipeLineCount = await this.recipeLineRepo.count({
      where: { supplyProductId: id },
    });

    const movementCount = await this.movementRepo.createQueryBuilder('movement')
      .innerJoin('movement.item', 'item')
      .where('item.supply_id = :supplyId', { supplyId: id })
      .getCount();

    return {
      inRecipes: recipeLineCount > 0,
      inMovements: movementCount > 0,
    };
  }
}
