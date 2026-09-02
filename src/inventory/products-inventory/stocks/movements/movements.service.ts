import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';

import { Movement } from './entities/movement.entity';
import {
  MovementResponseDto,
  OneMovementResponse,
} from './dto/movement-response.dto';
import { GetMovementsQueryDto } from './dto/get-movements-query.dto';
import { AllPaginatedMovements } from './dto/all-paginated-movements.dto';
import { ItemLittleResponseDto } from '../items/dto/item-response.dto';
import { ErrorHandler } from 'src/common/utils/error-handler.util';
import { ErrorMessage } from 'src/common/constants/error-messages';
import { Item } from '../items/entities/item.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { ProductRecipe } from '../../recipes/entities/product-recipe.entity';
import { Order } from 'src/restaurant-operations/pos/orders/entities/order.entity';
import { StockLevelMonitorService } from '../../../stock-alerts/stock-level-monitor.service';
import { MovementsStatus } from './constants/movements-status';
import { Location } from '../locations/entities/location.entity';


@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(Movement)
    private readonly movementRepository: Repository<Movement>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(ProductRecipe)
    private readonly recipeRepository: Repository<ProductRecipe>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly stockLevelMonitor: StockLevelMonitorService,
  ) {}

  async create(
    merchant_id: number,
    createMovementDto: CreateMovementDto & {
      sourceLocationId?: number | null;
      destinationLocationId?: number | null;
      createdBy?: string | null;
      movementType?: string | null;
      unitCost?: number | string | null;
      supplyId?: number | null;
    },
  ): Promise<OneMovementResponse> {
    const { stockItemId, quantity, type, reference, reason, sourceLocationId, destinationLocationId, createdBy, movementType, unitCost, supplyId } =
      createMovementDto;
    const merchantId = merchant_id;

    if (quantity <= 0) {
      throw new BadRequestException('Movement quantity must be greater than 0.');
    }

    const merchant = await this.itemRepository.manager.findOne(Merchant, {
      where: { id: merchantId },
      select: ['companyId'],
    });

    let item: Item | null = null;

    if (stockItemId && stockItemId > 0) {
      item = await this.itemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .leftJoinAndSelect('item.supply', 'supply')
        .leftJoinAndSelect('item.location', 'location')
        .where('item.id = :stockItemId', { stockItemId })
        .andWhere('(product.merchantId = :merchantId OR supply.company_id = :companyId)', {
          merchantId,
          companyId: merchant?.companyId,
        })
        .andWhere('item.isActive = :isActive', { isActive: true })
        .getOne();
    } else if (supplyId && (sourceLocationId || destinationLocationId)) {
      const targetLocId = sourceLocationId || destinationLocationId;
      item = await this.itemRepository.findOne({
        where: {
          supplyId,
          locationId: targetLocId,
          isActive: true,
        },
        relations: ['supply', 'location'],
      });

      if (!item && targetLocId) {
        item = this.itemRepository.create({
          supplyId,
          locationId: targetLocId,
          currentQty: 0,
          minimumQty: 5,
          isActive: true,
          weightedAverageUnitCost: unitCost ? String(unitCost) : '0.0000',
        });
        item = await this.itemRepository.save(item);
        item = await this.itemRepository.findOne({
          where: { id: item.id },
          relations: ['supply', 'location'],
        });
      }
    }

    if (!item) {
      throw new NotFoundException('Stock item record not found for the selected raw material and location.');
    }

    // 1. Guard de validación para Transferencias
    if (movementType === 'TRANSFER') {
      if (sourceLocationId && destinationLocationId && Number(sourceLocationId) === Number(destinationLocationId)) {
        throw new BadRequestException('Source and destination locations must be different.');
      }
    }

    // 2. Insufficient Stock Guard para TRANSFER, WASTE, POS_DEPLETION o salidas
    const isDecrement = movementType === 'TRANSFER' || movementType === 'WASTE' || movementType === 'POS_DEPLETION' || type === MovementsStatus.OUT;
    if (isDecrement) {
      const sourceLocationName = item.location?.name || 'Source Location';
      const availableStock = Number(item.currentQty || 0);
      if (availableStock < quantity) {
        throw new BadRequestException(
          `Insufficient stock in [${sourceLocationName}]. Available: ${availableStock}, Requested: ${quantity}.`
        );
      }
    }

    // 3. Mutación de existencias según tipo de movimiento
    const isEntry = type === MovementsStatus.IN || (type as any) === 'IN' || ['PURCHASE_RECEIPT', 'RETURN'].includes(movementType || '');
    const isTransfer = movementType === 'TRANSFER' && destinationLocationId && Number(destinationLocationId) !== item.locationId;

    if (isTransfer) {
      // Restar stock de almacén de origen
      item.currentQty = Math.max(0, Number(item.currentQty || 0) - Number(quantity));
      await this.itemRepository.save(item);

      // Incrementar stock en almacén de destino
      let destItem = await this.itemRepository.findOne({
        where: {
          supplyId: item.supplyId || undefined,
          productId: item.productId || undefined,
          variantId: item.variantId || undefined,
          locationId: destinationLocationId,
          isActive: true,
        },
      });

      if (!destItem) {
        destItem = this.itemRepository.create({
          supplyId: item.supplyId,
          productId: item.productId,
          variantId: item.variantId,
          locationId: destinationLocationId,
          currentQty: 0,
          minimumQty: 5,
          isActive: true,
          weightedAverageUnitCost: item.weightedAverageUnitCost || '0.0000',
        });
      }

      destItem.currentQty = Number(destItem.currentQty || 0) + Number(quantity);
      await this.itemRepository.save(destItem);
    } else if (isEntry) {
      item.currentQty = Number(item.currentQty || 0) + Number(quantity);
      if (unitCost) {
        item.weightedAverageUnitCost = String(unitCost);
      }
      await this.itemRepository.save(item);
    } else {
      item.currentQty = Math.max(0, Number(item.currentQty || 0) - Number(quantity));
      await this.itemRepository.save(item);
    }

    const newMovement = this.movementRepository.create({
      stockItemId: item.id,
      item,
      quantity,
      type: isEntry ? MovementsStatus.IN : MovementsStatus.OUT,
      reference,
      reason,
      merchantId: merchant_id,
      isActive: true,
      sourceLocationId: sourceLocationId ?? item.locationId ?? null,
      destinationLocationId: destinationLocationId ?? null,
      createdBy: createdBy ?? null,
      movementType: movementType ?? (isEntry ? 'PURCHASE_RECEIPT' : 'ADJUSTMENT'),
      unitCost: unitCost ? String(unitCost) : item.weightedAverageUnitCost,
    });

    const savedMovement = await this.movementRepository.save(newMovement);

    // Monitorear y evaluar alertas de stock mínimo
    try {
      await this.stockLevelMonitor.evaluateStockItems(merchantId, [item.id]);
    } catch (e) {
      console.error('Error evaluating stock levels post movement:', e);
    }

    return this.findOne(savedMovement.id, merchantId, 'Created');
  }

  async findAll(
    query: GetMovementsQueryDto,
    merchantId: number,
  ): Promise<AllPaginatedMovements> {
    // 1. Configure pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // 2. Build query with filters
    const merchant = await this.itemRepository.manager.findOne(Merchant, {
      where: { id: merchantId },
      select: ['companyId'],
    });

    const queryBuilder = this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.item', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.supply', 'supply')
      .leftJoinAndSelect('item.location', 'itemLocation')
      .leftJoinAndSelect('movement.sourceLocation', 'sourceLocation')
      .leftJoinAndSelect('movement.destinationLocation', 'destinationLocation')
      .leftJoinAndSelect('movement.merchant', 'merchant')
      .where('(product.merchantId = :merchantId OR supply.company_id = :companyId)', {
        merchantId,
        companyId: merchant?.companyId,
      })
      .andWhere('movement.isActive = :isActive', { isActive: true });

    if (query.itemName) {
      queryBuilder.andWhere(
        '(LOWER(product.name) LIKE LOWER(:itemName) OR LOWER(supply.name) LIKE LOWER(:itemName))',
        { itemName: `%${query.itemName}%` },
      );
    }

    if (query.itemId) {
      queryBuilder.andWhere('item.id = :itemId', {
        itemId: query.itemId,
      });
    }

    if (query.startDate) {
      queryBuilder.andWhere('movement.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      queryBuilder.andWhere('movement.createdAt <= :endDate', {
        endDate: end,
      });
    }

    if (query.movementType) {
      queryBuilder.andWhere('movement.movementType = :movementType', {
        movementType: query.movementType,
      });
    }

    if (query.supplyId) {
      queryBuilder.andWhere('item.supplyId = :supplyId', {
        supplyId: query.supplyId,
      });
    }

    // 4. Get total records
    const total = await queryBuilder.getCount();

    // 5. Apply pagination and sorting
    const movements = await queryBuilder
      .orderBy('movement.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    // 6. Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // 7. Map to MovementResponseDto
    const data: MovementResponseDto[] = await Promise.all(
      movements.map((movement) => {
        const result: MovementResponseDto = {
          id: movement.id,
          item: movement.item
            ? ({
                id: movement.item.id,
                currentQty: movement.item.currentQty,
                product: movement.item.product ? { name: movement.item.product.name } : null,
                supply: movement.item.supply ? { name: movement.item.supply.name } : null,
                location: movement.item.location ? { id: movement.item.location.id, name: movement.item.location.name } : null,
              } as any)
            : null,
          quantity: movement.quantity,
          type: movement.type,
          reference: movement.reference,
          reason: movement.reason,
          sourceLocationId: movement.sourceLocationId,
          sourceLocationName: movement.sourceLocation?.name || movement.item?.location?.name || null,
          destinationLocationId: movement.destinationLocationId,
          destinationLocationName: movement.destinationLocation?.name || null,
          unitCost: movement.unitCost ? String(movement.unitCost) : (movement.item?.weightedAverageUnitCost || null),
          createdBy: movement.createdBy,
          movementType: movement.movementType,
          merchant: movement.merchant
            ? {
                id: movement.merchant.id,
                name: movement.merchant.name,
              }
            : null,
          createdAt: movement.createdAt,
        };
        return result;
      }),
    );

    return {
      statusCode: 200,
      message: 'Movements retrieved successfully',
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
  ): Promise<OneMovementResponse> {
    if (!id || id <= 0) {
      ErrorHandler.invalidId('Movement ID is incorrect');
    }

    const whereCondition: {
      id: number;
      merchantId?: number;
      isActive: boolean;
    } = {
      id,
      isActive: createdUpdateDelete === 'Deleted' ? false : true,
    };

    if (merchantId !== undefined) {
      whereCondition.merchantId = merchantId;
    }

    let companyId: number | undefined;
    if (merchantId !== undefined) {
      const merchant = await this.itemRepository.manager.findOne(Merchant, {
        where: { id: merchantId },
        select: ['companyId'],
      });
      companyId = merchant?.companyId;
    }

    const movementQueryBuilder = this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.item', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.supply', 'supply')
      .leftJoinAndSelect('item.location', 'itemLocation')
      .leftJoinAndSelect('movement.sourceLocation', 'sourceLocation')
      .leftJoinAndSelect('movement.destinationLocation', 'destinationLocation')
      .leftJoinAndSelect('movement.merchant', 'merchant')
      .where('movement.id = :id', { id })
      .andWhere('movement.isActive = :isActive', {
        isActive: whereCondition.isActive,
      });

    if (merchantId !== undefined) {
      movementQueryBuilder.andWhere(
        '(product.merchantId = :merchantId OR supply.company_id = :companyId)',
        { merchantId, companyId },
      );
    }

    const movement = await movementQueryBuilder.getOne();

    if (!movement) {
      ErrorHandler.notFound(ErrorMessage.MOVEMENT_NOT_FOUND);
    }

    const result: MovementResponseDto = {
      id: movement.id,
      item: movement.item
        ? ({
            id: movement.item.id,
            currentQty: movement.item.currentQty,
            product: movement.item.product ? { name: movement.item.product.name } : null,
            supply: movement.item.supply ? { name: movement.item.supply.name } : null,
            location: movement.item.location ? { id: movement.item.location.id, name: movement.item.location.name } : null,
          } as any)
        : null,
      quantity: movement.quantity,
      type: movement.type,
      reference: movement.reference,
      reason: movement.reason,
      sourceLocationId: movement.sourceLocationId,
      sourceLocationName: movement.sourceLocation?.name || movement.item?.location?.name || null,
      destinationLocationId: movement.destinationLocationId,
      destinationLocationName: movement.destinationLocation?.name || null,
      unitCost: movement.unitCost ? String(movement.unitCost) : (movement.item?.weightedAverageUnitCost || null),
      createdBy: movement.createdBy,
      movementType: movement.movementType,
      merchant: movement.merchant
        ? {
            id: movement.merchant.id,
            name: movement.merchant.name,
          }
        : null,
      createdAt: movement.createdAt,
    };

    let response: OneMovementResponse;

    switch (createdUpdateDelete) {
      case 'Created':
        response = {
          statusCode: 201,
          message: `Movement ${createdUpdateDelete} successfully`,
          data: result,
        };
        break;
      case 'Updated':
        response = {
          statusCode: 200,
          message: `Movement ${createdUpdateDelete} successfully`,
          data: result,
        };
        break;
      case 'Deleted':
        response = {
          statusCode: 200,
          message: `Movement ${createdUpdateDelete} successfully`,
          data: result,
        };
        break;
      default:
        response = {
          statusCode: 200,
          message: 'Movement retrieved successfully',
          data: result,
        };
        break;
    }
    return response;
  }

  async update(
    id: number,
    merchant_id: number,
    updateMovementDto: UpdateMovementDto,
  ): Promise<OneMovementResponse> {
    if (!id || id <= 0) {
      ErrorHandler.invalidId('Movement ID is incorrect');
    }
    const merchantId = merchant_id;
    const { stockItemId, quantity, type, reference, reason } =
      updateMovementDto;

    const movement = await this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.item', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('movement.merchant', 'merchant')
      .where('movement.id = :id', { id })
      .andWhere('product.merchantId = :merchantId', { merchantId })
      .andWhere('movement.isActive = :isActive', { isActive: true })
      .getOne();

    if (!movement) {
      ErrorHandler.notFound(ErrorMessage.MOVEMENT_NOT_FOUND);
    }

    if (stockItemId) {
      const item = await this.itemRepository
        .createQueryBuilder('item')
        .leftJoinAndSelect('item.product', 'product')
        .where('item.id = :stockItemId', { stockItemId })
        .andWhere('product.merchantId = :merchantId', { merchantId })
        .andWhere('item.isActive = :isActive', { isActive: true })
        .getOne();

      if (!item) {
        ErrorHandler.notFound(ErrorMessage.ITEM_NOT_FOUND);
      }
      movement.item = item;
    }

    if (quantity) {
      movement.quantity = quantity;
    }

    if (type) {
      movement.type = type;
    }

    if (reference) {
      movement.reference = reference;
    }

    if (reason) {
      movement.reason = reason;
    }

    const updatedMovement = await this.movementRepository.save(movement);

    return this.findOne(updatedMovement.id, merchantId, 'Updated');
  }

  async remove(id: number, merchant_id: number): Promise<OneMovementResponse> {
    if (!id || id <= 0) {
      ErrorHandler.invalidId('Movement ID is incorrect');
    }
    const merchantId = merchant_id;

    const movement = await this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.item', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('movement.merchant', 'merchant')
      .where('movement.id = :id', { id })
      .andWhere('product.merchantId = :merchantId', { merchantId })
      .andWhere('movement.isActive = :isActive', { isActive: true })
      .getOne();

    if (!movement) {
      ErrorHandler.notFound(ErrorMessage.MOVEMENT_NOT_FOUND);
    }

    movement.isActive = false;
    const removedMovement = await this.movementRepository.save(movement);

    return this.findOne(removedMovement.id, merchantId, 'Deleted');
  }

  async depleteFromOrder(merchantId: number, orderId: number): Promise<{ success: boolean; movementsCount: number }> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, merchant_id: merchantId },
      relations: ['orderItems'],
    });
    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const merchant = await this.itemRepository.manager.findOne(Merchant, {
      where: { id: merchantId },
      select: ['defaultSalesStockLocationId'],
    });

    let defaultLocationId = merchant?.defaultSalesStockLocationId;
    if (!defaultLocationId) {
      const firstLocation = await this.itemRepository.manager.findOne(Location, {
        where: { merchantId, isActive: true },
        order: { id: 'ASC' },
      });
      defaultLocationId = firstLocation?.id;
    }


    if (!defaultLocationId) {
      return { success: false, movementsCount: 0 };
    }


    let movementsCount = 0;
    const evaluatedStockIds = new Set<number>();

    for (const orderItem of order.orderItems || []) {
      let recipe: ProductRecipe | null = null;

      if (orderItem.variant_id) {
        recipe = await this.recipeRepository.findOne({
          where: {
            merchantId,
            finishedProductId: orderItem.product_id,
            finishedVariantId: orderItem.variant_id,
          },
          relations: ['lines', 'lines.rawMaterial'],
        });
      }

      if (!recipe) {
        recipe = await this.recipeRepository.findOne({
          where: {
            merchantId,
            finishedProductId: orderItem.product_id,
          },
          relations: ['lines', 'lines.rawMaterial'],
        });
      }

      if (!recipe || !recipe.lines) {
        continue;
      }



      for (const line of recipe.lines) {
        if (!line.rawMaterialId) {
          continue;
        }

        const qtyPerUnit = Number(line.quantityPerSoldUnit || line.quantity || 0);
        const quantityToDeduct = qtyPerUnit * Number(orderItem.quantity || 1);
        if (quantityToDeduct <= 0) {
          continue;
        }

        // Buscar el stock_item del ingrediente en el almacén de venta por defecto
        let stockItem = await this.itemRepository.findOne({
          where: {
            supplyId: line.rawMaterialId,
            locationId: defaultLocationId,
            isActive: true,
          },
        });

        if (!stockItem) {
          // Si no existe el stock_item, lo creamos con cantidad 0 para que quede registro
          stockItem = this.itemRepository.create({
            supplyId: line.rawMaterialId,
            locationId: defaultLocationId,
            currentQty: 0,
            minimumQty: 5,
            isActive: true,
            weightedAverageUnitCost: '0.0000',
          });
          stockItem = await this.itemRepository.save(stockItem);
        }

        // Decrementar el stock
        stockItem.currentQty = Math.max(0, Number(stockItem.currentQty || 0) - quantityToDeduct);
        await this.itemRepository.save(stockItem);
        evaluatedStockIds.add(stockItem.id);

        // Crear el movimiento de stock auditado
        const movement = this.movementRepository.create({
          stockItemId: stockItem.id,
          quantity: Math.ceil(quantityToDeduct),
          type: MovementsStatus.OUT,
          reference: `POS Order #${order.order_number || orderId}`,
          reason: 'Automatic recipe depletion from POS sale',
          merchantId,
          isActive: true,
          sourceLocationId: defaultLocationId,
          createdBy: 'POS System',
          movementType: 'POS_DEPLETION',
          orderId: order.id,
        });


        await this.movementRepository.save(movement);
        movementsCount++;
      }
    }

    if (evaluatedStockIds.size > 0) {
      await this.stockLevelMonitor.evaluateStockItems(merchantId, Array.from(evaluatedStockIds));
    }

    return { success: true, movementsCount };
  }
}
