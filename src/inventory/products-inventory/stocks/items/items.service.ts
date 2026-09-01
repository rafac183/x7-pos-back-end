import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Item } from './entities/item.entity';
import { Repository } from 'typeorm';
import { ItemResponseDto, OneItemResponse } from './dto/item-response.dto';
import { GetItemsQueryDto } from './dto/get-items-query.dto';
import { AllPaginatedItems } from './dto/all-paginated-items.dto';
import { ErrorMessage } from 'src/common/constants/error-messages';
import { LocationLittleResponseDto } from '../locations/dto/location-response.dto';
import { ErrorHandler } from 'src/common/utils/error-handler.util';
import { Product } from '../../products/entities/product.entity';
import { Variant } from '../../variants/entities/variant.entity';
import { MovementsService } from '../movements/movements.service';
import { MovementsStatus } from '../movements/constants/movements-status';
import { Location } from '../locations/entities/location.entity';
import { ProductLittleResponseDto } from '../../products/dto/product-response.dto';
import { VariantLittleResponseDto } from '../../variants/dto/variant-response.dto';
import { StockLevelMonitorService } from '../../../stock-alerts/stock-level-monitor.service';
import { Supply } from 'src/inventory/supplies/entities/supply.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(Variant)
    private readonly variantRepository: Repository<Variant>,
    @InjectRepository(Supply)
    private readonly supplyRepository: Repository<Supply>,
    private readonly movementsService: MovementsService,
    private readonly stockLevelMonitor: StockLevelMonitorService,
  ) {}

  async create(
    merchant_id: number,
    createItemDto: CreateItemDto,
  ): Promise<OneItemResponse> {
    const { productId, locationId, variantId, supplyId, currentQty, minimumQty } =
      createItemDto;
    const merchantId = merchant_id;

    if (!supplyId && (!productId || !variantId)) {
      throw new BadRequestException(
        'Must provide either supplyId OR both productId and variantId',
      );
    }

    const location = await this.locationRepository.findOneBy({
      id: locationId,
      isActive: true,
      merchantId: merchant_id,
    });
    if (!location) {
      ErrorHandler.notFound(ErrorMessage.LOCATION_NOT_FOUND);
    }

    let product: Product | null = null;
    let variant: Variant | null = null;
    let supply: Supply | null = null;

    if (supplyId) {
      // Buscar insumo asociado a la compañía del merchant
      const merchant = await this.locationRepository.manager.findOne(Merchant, {
        where: { id: merchant_id },
        select: ['companyId'],
      });
      supply = await this.supplyRepository.findOneBy({
        id: supplyId,
        isActive: true,
        company_id: merchant?.companyId,
      });
      if (!supply) {
        throw new NotFoundException('Raw material supply not found or inactive');
      }

      const existingItem = await this.itemRepository.findOne({
        where: {
          supply: { id: supplyId },
          location: { id: locationId },
        },
      });

      if (existingItem) {
        if (existingItem.isActive) {
          ErrorHandler.exists('Stock item already exists for this raw material at this location');
        } else {
          existingItem.isActive = true;
          const activatedItem = await this.itemRepository.save(existingItem);
          return this.findOne(activatedItem.id, merchantId, 'Created');
        }
      }
    } else {
      const [prod, varnt] = await Promise.all([
        this.productRepository.findOneBy({
          id: productId,
          isActive: true,
          merchantId: merchant_id,
        }),
        this.variantRepository.findOneBy({
          id: variantId,
          isActive: true,
          product: { id: productId, merchantId: merchant_id },
        }),
      ]);

      if (!prod) {
        ErrorHandler.notFound(ErrorMessage.PRODUCT_NOT_FOUND);
      }
      if (!varnt) {
        ErrorHandler.notFound(ErrorMessage.VARIANT_NOT_FOUND);
      }
      product = prod;
      variant = varnt;

      const existingItem = await this.itemRepository.findOne({
        where: {
          product: { id: productId },
          location: { id: locationId },
          variant: { id: variant.id },
        },
      });

      if (existingItem) {
        if (existingItem.isActive) {
          ErrorHandler.exists(ErrorMessage.ITEM_EXISTS);
        } else {
          existingItem.isActive = true;
          const activatedItem = await this.itemRepository.save(existingItem);
          return this.findOne(activatedItem.id, merchantId, 'Created');
        }
      }
    }

    const newItem = this.itemRepository.create({
      currentQty,
      minimumQty: minimumQty ?? null,
      product,
      location,
      variant,
      supply,
    });

    const savedItem = await this.itemRepository.save(newItem);

    await this.stockLevelMonitor.evaluateStockItems(merchantId, [savedItem.id]);

    return this.findOne(savedItem.id, merchantId, 'Created');
  }

  async findAll(
    query: GetItemsQueryDto,
    merchantId: number,
  ): Promise<AllPaginatedItems> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const merchant = await this.locationRepository.manager.findOne(Merchant, {
      where: { id: merchantId },
      select: ['companyId'],
    });

    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.variant', 'variant')
      .leftJoinAndSelect('item.location', 'location')
      .leftJoinAndSelect('item.supply', 'supply')
      .where('(product.merchantId = :merchantId OR supply.company_id = :companyId)', {
        merchantId,
        companyId: merchant?.companyId,
      })
      .andWhere('item.isActive = :isActive', { isActive: true });

    if (query.productName) {
      queryBuilder.andWhere(
        '(LOWER(product.name) LIKE LOWER(:productName) OR LOWER(supply.name) LIKE LOWER(:productName))',
        { productName: `%${query.productName}%` },
      );
    }

    if (query.variantName) {
      queryBuilder.andWhere('LOWER(variant.name) LIKE LOWER(:variantName)', {
        variantName: `%${query.variantName}%`,
      });
    }

    if (query.locationId) {
      queryBuilder.andWhere('item.locationId = :locationId', {
        locationId: query.locationId,
      });
    }

    if (query.supplyId) {
      queryBuilder.andWhere('item.supplyId = :supplyId', {
        supplyId: query.supplyId,
      });
    }

    const total = await queryBuilder.getCount();

    const allItems = await queryBuilder
      .addSelect('COALESCE(product.name, supply.name)', 'itemName')
      .orderBy('"itemName"', 'ASC')
      .getMany();

    const items = allItems.slice(skip, skip + limit);

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const data: ItemResponseDto[] = items.map((item) => {
      const result: ItemResponseDto = {
        id: item.id,
        currentQty: item.currentQty,
        weightedAverageUnitCost:
          item.weightedAverageUnitCost != null
            ? Number(item.weightedAverageUnitCost)
            : null,
        minimumQty: item.minimumQty ?? null,
        product: item.product
          ? ({
              id: item.product.id,
              name: item.product.name,
              sku: item.product.sku,
            } as ProductLittleResponseDto)
          : null,
        variant: item.variant
          ? ({
              id: item.variant.id,
              name: item.variant.name,
            } as VariantLittleResponseDto)
          : null,
        supply: item.supply
          ? {
              id: item.supply.id,
              name: item.supply.name,
              code: item.supply.code,
              sku: item.supply.sku,
            }
          : null,
        location: item.location
          ? ({
              id: item.location.id,
              name: item.location.name,
            } as LocationLittleResponseDto)
          : null,
      };
      return result;
    });

    return {
      statusCode: 200,
      message: 'Items retrieved successfully',
      data,
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    };
  }

  async findOne(
    id: number,
    merchantId?: number,
    createdUpdateDelete?: string,
  ): Promise<OneItemResponse> {
    if (!id || id <= 0) {
      ErrorHandler.invalidId('Item ID is incorrect');
    }

    let companyId: number | undefined;
    if (merchantId !== undefined) {
      const merchant = await this.locationRepository.manager.findOne(Merchant, {
        where: { id: merchantId },
        select: ['companyId'],
      });
      companyId = merchant?.companyId;
    }

    const queryBuilder = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.variant', 'variant')
      .leftJoinAndSelect('item.location', 'location')
      .leftJoinAndSelect('item.supply', 'supply')
      .where('item.id = :id', { id })
      .andWhere('item.isActive = :isActive', {
        isActive: createdUpdateDelete === 'Deleted' ? false : true,
      });

    if (merchantId !== undefined) {
      queryBuilder.andWhere(
        '(product.merchantId = :merchantId OR supply.company_id = :companyId)',
        { merchantId, companyId },
      );
    }

    const item = await queryBuilder.getOne();

    if (!item) {
      ErrorHandler.notFound(ErrorMessage.ITEM_NOT_FOUND);
    }

    const result: ItemResponseDto = {
      id: item.id,
      currentQty: item.currentQty,
      weightedAverageUnitCost:
        item.weightedAverageUnitCost != null
          ? Number(item.weightedAverageUnitCost)
          : null,
      minimumQty: item.minimumQty ?? null,
      product: item.product
        ? ({
            id: item.product.id,
            name: item.product.name,
            sku: item.product.sku,
          } as ProductLittleResponseDto)
        : null,
      variant: item.variant
        ? ({
            id: item.variant.id,
            name: item.variant.name,
          } as VariantLittleResponseDto)
        : null,
      supply: item.supply
        ? {
            id: item.supply.id,
            name: item.supply.name,
            code: item.supply.code,
            sku: item.supply.sku,
          }
        : null,
      location: item.location
        ? ({
            id: item.location.id,
            name: item.location.name,
          } as LocationLittleResponseDto)
        : null,
    };

    let response: OneItemResponse;

    switch (createdUpdateDelete) {
      case 'Created':
        response = {
          statusCode: 201,
          message: `Item ${createdUpdateDelete} successfully`,
          data: result,
        };
        break;
      case 'Updated':
        response = {
          statusCode: 200,
          message: `Item ${createdUpdateDelete} successfully`,
          data: result,
        };
        break;
      case 'Deleted':
        response = {
          statusCode: 200,
          message: `Item ${createdUpdateDelete} successfully`,
          data: result,
        };
        break;
      default:
        response = {
          statusCode: 200,
          message: 'Item retrieved successfully',
          data: result,
        };
        break;
    }
    return response;
  }

  async update(
    id: number,
    merchant_id: number,
    updateItemDto: UpdateItemDto,
  ): Promise<OneItemResponse> {
    if (!id || id <= 0) {
      ErrorHandler.invalidId('Item ID is incorrect');
    }
    const merchantId = merchant_id;
    const { productId, locationId, variantId, supplyId, currentQty, minimumQty } =
      updateItemDto;

    const merchant = await this.locationRepository.manager.findOne(Merchant, {
      where: { id: merchantId },
      select: ['companyId'],
    });

    const existingItem = await this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.location', 'location')
      .leftJoinAndSelect('item.variant', 'variant')
      .leftJoinAndSelect('item.supply', 'supply')
      .where('item.id = :id', { id })
      .andWhere('(product.merchantId = :merchantId OR supply.company_id = :companyId)', {
        merchantId,
        companyId: merchant?.companyId,
      })
      .andWhere('item.isActive = :isActive', { isActive: true })
      .getOne();

    if (!existingItem) {
      ErrorHandler.notFound(ErrorMessage.ITEM_NOT_FOUND);
    }

    const oldLocation = existingItem.location;

    if (locationId) {
      const location = await this.locationRepository.findOneBy({
        id: locationId,
        isActive: true,
        merchantId: merchant_id,
      });
      if (!location) ErrorHandler.notFound(ErrorMessage.LOCATION_NOT_FOUND);
      existingItem.location = location;
    }

    if (supplyId) {
      const supply = await this.supplyRepository.findOneBy({
        id: supplyId,
        isActive: true,
        company_id: merchant?.companyId,
      });
      if (!supply) throw new NotFoundException('Supply not found');
      existingItem.supply = supply;
      existingItem.product = null;
      existingItem.variant = null;
    } else if (productId && variantId) {
      const [product, variant] = await Promise.all([
        this.productRepository.findOneBy({
          id: productId,
          isActive: true,
          merchantId: merchant_id,
        }),
        this.variantRepository.findOneBy({
          id: variantId,
          productId: productId,
          isActive: true,
          product: { id: productId, merchantId: merchant_id },
        }),
      ]);
      if (!product) ErrorHandler.notFound(ErrorMessage.PRODUCT_NOT_FOUND);
      if (!variant) ErrorHandler.notFound(ErrorMessage.VARIANT_NOT_FOUND);

      existingItem.product = product;
      existingItem.variant = variant;
      existingItem.supply = null;
    }

    if (currentQty !== undefined) {
      existingItem.currentQty = currentQty;
    }
    if (minimumQty !== undefined) {
      existingItem.minimumQty = minimumQty ?? null;
    }

    const updatedItem = await this.itemRepository.save(existingItem);

    if (locationId && oldLocation.id !== updatedItem.location.id) {
      await this.movementsService.create(merchantId, {
        stockItemId: updatedItem.id,
        quantity: updatedItem.currentQty,
        type: MovementsStatus.OUT,
        reference: `Movement between locations: Exit from ${oldLocation.name}`,
        reason: 'Transfer between stock locations',
      });

      await this.movementsService.create(merchantId, {
        stockItemId: updatedItem.id,
        quantity: updatedItem.currentQty,
        type: MovementsStatus.IN,
        reference: `Movement between locations: Entry to ${updatedItem.location.name}`,
        reason: 'Transfer between stock locations',
      });
    }

    await this.stockLevelMonitor.evaluateStockItems(merchantId, [
      updatedItem.id,
    ]);

    return this.findOne(updatedItem.id, merchantId, 'Updated');
  }

  async remove(id: number, merchant_id: number): Promise<OneItemResponse> {
    if (!id || id <= 0) {
      ErrorHandler.invalidId('Item ID is incorrect');
    }
    const merchantId = merchant_id;

    const merchant = await this.locationRepository.manager.findOne(Merchant, {
      where: { id: merchantId },
      select: ['companyId'],
    });

    const item = await this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.supply', 'supply')
      .where('item.id = :id', { id })
      .andWhere('(product.merchantId = :merchantId OR supply.company_id = :companyId)', {
        merchantId,
        companyId: merchant?.companyId,
      })
      .andWhere('item.isActive = :isActive', { isActive: true })
      .getOne();

    if (!item) {
      ErrorHandler.notFound(ErrorMessage.ITEM_NOT_FOUND);
    }

    item.isActive = false;
    const removedItem = await this.itemRepository.save(item);

    return this.findOne(removedItem.id, merchantId, 'Deleted');
  }

  async softRemoveByProductId(
    productId: number,
    merchantId: number,
  ): Promise<void> {
    const items = await this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .where('item.productId = :productId', { productId })
      .andWhere('item.isActive = :isActive', { isActive: true })
      .andWhere('product.merchantId = :merchantId', { merchantId })
      .getMany();

    if (items.length > 0) {
      for (const item of items) {
        item.isActive = false;
        item.currentQty = 0;
      }
      await this.itemRepository.save(items);
    }
  }

  async adjust(
    id: number,
    merchantId: number,
    adjustStockDto: AdjustStockDto,
  ): Promise<OneItemResponse> {
    const { value, type, reason } = adjustStockDto;

    const merchant = await this.locationRepository.manager.findOne(Merchant, {
      where: { id: merchantId },
      select: ['companyId'],
    });

    const item = await this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.variant', 'variant')
      .leftJoinAndSelect('item.location', 'location')
      .leftJoinAndSelect('item.supply', 'supply')
      .where('item.id = :id', { id })
      .andWhere('(product.merchantId = :merchantId OR supply.company_id = :companyId)', {
        merchantId,
        companyId: merchant?.companyId,
      })
      .andWhere('item.isActive = :isActive', { isActive: true })
      .getOne();

    if (!item) {
      ErrorHandler.notFound(ErrorMessage.ITEM_NOT_FOUND);
    }

    const oldQty = Number(item.currentQty) || 0;
    let newQty = oldQty;
    let diff = 0;

    if (type === 'absolute') {
      newQty = value;
      diff = newQty - oldQty;
    } else {
      newQty = oldQty + value;
      diff = value;
    }

    item.currentQty = newQty;
    const savedItem = await this.itemRepository.save(item);

    if (diff !== 0) {
      await this.movementsService.create(merchantId, {
        stockItemId: item.id,
        quantity: Math.abs(diff),
        type: diff > 0 ? MovementsStatus.IN : MovementsStatus.OUT,
        reference: 'Manual Stock Correction',
        reason: reason || 'Manual adjustment by administrator',
      });
    }

    await this.stockLevelMonitor.evaluateStockItems(merchantId, [savedItem.id]);

    return this.findOne(savedItem.id, merchantId, 'Updated');
  }
}
