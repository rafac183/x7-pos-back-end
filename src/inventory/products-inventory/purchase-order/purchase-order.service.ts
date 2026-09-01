import { Injectable } from '@nestjs/common';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { GetPurchaseOrdersQueryDto } from './dto/get-purchase-orders-query.dto';
import { AllPaginatedPurchaseOrders } from './dto/all-paginated-purchase-order.dto';
import { PurchaseOrder } from './entities/purchase-order.entity';
import {
  OnePurchaseOrderResponse,
  PurchaseOrderResponseDto,
} from './dto/purchase-order-response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, DeepPartial } from 'typeorm';
import { ErrorHandler } from 'src/common/utils/error-handler.util';
import { ErrorMessage } from 'src/common/constants/error-messages';
import { Supplier } from '../../../core/business-partners/suppliers/entities/supplier.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { PurchaseOrderItem } from '../purchase-order-item/entities/purchase-order-item.entity';
import { Location } from '../stocks/locations/entities/location.entity';
import { Item } from '../stocks/items/entities/item.entity';
import { PurchaseOrderStatus } from './constants/purchase-order-status.enum';
import { MovementsService } from '../stocks/movements/movements.service';
import { MovementsStatus } from '../stocks/movements/constants/movements-status';
import { Supply } from 'src/inventory/supplies/entities/supply.entity';
import { Movement } from '../stocks/movements/entities/movement.entity';
import { StockLevelMonitorService } from '../../stock-alerts/stock-level-monitor.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReceiveItemsDto } from './dto/receive-items.dto';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(Item)
    private readonly itemRepository: Repository<Item>,
    @InjectRepository(Supply)
    private readonly supplyRepository: Repository<Supply>,
    @InjectRepository(Movement)
    private readonly movementRepository: Repository<Movement>,
    private readonly movementsService: MovementsService,
    private readonly stockLevelMonitor: StockLevelMonitorService,
  ) {}

  async create(
    merchant_id: number,
    createPurchaseOrderDto: CreatePurchaseOrderDto,
  ): Promise<OnePurchaseOrderResponse> {
    const { supplierId, items, ...purchaseOrderData } = createPurchaseOrderDto;

    const [supplier] = await Promise.all([
      (async () => {
        const merchant = await this.merchantRepository.findOne({
          where: { id: merchant_id },
          select: ['companyId'],
        });
        if (!merchant) return null;
        return this.supplierRepository.findOneBy({
          id: supplierId,
          company_id: merchant.companyId,
        });
      })(),
    ]);

    if (!supplier) ErrorHandler.notFound(ErrorMessage.SUPPLIER_NOT_FOUND);

    try {
      let calculatedTotal = 0;
      const itemsToSave: {
        productId?: number | null;
        variantId?: number | null;
        rawMaterialId?: number | null;
        purchaseUnit?: string | null;
        quantityOrdered?: number | null;
        unitCost?: number | null;
        taxAmount?: number | null;
        locationId: number;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }[] = [];

      if (items && Array.isArray(items)) {
        for (const item of items) {
          if (!item.locationId) {
            throw new BadRequestException('Cada ítem de la orden de compra debe tener una localización de destino asignada.');
          }

          if (item.rawMaterialId) {
            const rawMaterial = await this.supplyRepository.findOneBy({
              id: item.rawMaterialId,
              company_id: supplier.company_id,
            });
            if (!rawMaterial) {
              throw new NotFoundException(`Raw material with ID ${item.rawMaterialId} not found under company`);
            }

            const qtyOrdered = Number(item.quantityOrdered) || 0;
            const cost = Number(item.unitCost) || 0;
            const tax = Number(item.taxAmount) || 0;
            const totalPrice = (qtyOrdered * cost) + tax;
            calculatedTotal += totalPrice;

            itemsToSave.push({
              rawMaterialId: rawMaterial.id,
              purchaseUnit: item.purchaseUnit || 'unit',
              quantityOrdered: qtyOrdered,
              unitCost: cost,
              taxAmount: tax,
              locationId: Number(item.locationId),
              quantity: Math.ceil(qtyOrdered), // Mapeo a cantidad entera para compatibilidad
              unitPrice: cost,
              totalPrice: totalPrice,
            });
          } else {
            // Mantenemos compatibilidad con productos terminados
            if (!item.variantId) {
              throw new BadRequestException('Cada ítem de producto terminado de la orden de compra debe tener una variante asociada.');
            }
            const qty = Number(item.quantity) || 0;
            const price = Number(item.unitPrice) || 0;
            const totalPrice = qty * price;
            calculatedTotal += totalPrice;

            itemsToSave.push({
              productId: Number(item.productId),
              variantId: Number(item.variantId),
              locationId: Number(item.locationId),
              quantity: qty,
              unitPrice: price,
              totalPrice: totalPrice,
            });
          }
        }
      }

      const finalTotal = purchaseOrderData.totalAmount !== undefined 
        ? purchaseOrderData.totalAmount 
        : calculatedTotal;

      const newPurchaseOrder = this.purchaseOrderRepository.create({
        status: purchaseOrderData.status || PurchaseOrderStatus.DRAFT,
        totalAmount: finalTotal,
        merchantId: merchant_id,
        supplierId,
      });

      const savedPurchaseOrder =
        await this.purchaseOrderRepository.save(newPurchaseOrder);

      if (itemsToSave.length > 0) {
        const itemsWithOrder = itemsToSave.map(item => {
          const poItem = new PurchaseOrderItem();
          poItem.productId = item.productId || null;
          poItem.variantId = item.variantId || null;
          poItem.rawMaterialId = item.rawMaterialId || null;
          poItem.purchaseUnit = item.purchaseUnit || null;
          poItem.quantityOrdered = item.quantityOrdered || null;
          poItem.unitCost = item.unitCost || null;
          poItem.taxAmount = item.taxAmount || 0;
          poItem.locationId = item.locationId;
          poItem.quantity = item.quantity;
          poItem.unitPrice = item.unitPrice;
          poItem.totalPrice = item.totalPrice;
          poItem.purchaseOrderId = savedPurchaseOrder.id;
          poItem.receivedQuantity = 0;
          return poItem;
        });
        await this.purchaseOrderItemRepository.save(itemsWithOrder);

        const targetReceivedStatuses = [PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.COMPLETED, PurchaseOrderStatus.PARTIALLY_RECEIVED];
        if (targetReceivedStatuses.includes(savedPurchaseOrder.status)) {
          await this.increaseStockForOrder(savedPurchaseOrder.id, merchant_id, savedPurchaseOrder.status);
        }
      }

      return this.findOne(savedPurchaseOrder.id, merchant_id, 'Created');
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      ErrorHandler.handleDatabaseError(error);
    }
  }

  async findAll(
    query: GetPurchaseOrdersQueryDto,
    merchantId: number,
  ): Promise<AllPaginatedPurchaseOrders> {
    // 1. Configure pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // 4. Build query with filters
    const queryBuilder = this.purchaseOrderRepository
      .createQueryBuilder('purchaseOrder')
      .leftJoinAndSelect('purchaseOrder.merchant', 'merchant')
      .leftJoinAndSelect('purchaseOrder.supplier', 'supplier')
      .leftJoinAndSelect('purchaseOrder.purchaseOrderItems', 'purchaseOrderItems')
      .where('purchaseOrder.merchantId = :merchantId', { merchantId })
      .andWhere('purchaseOrder.isActive = :isActive', { isActive: true });

    // 5. Apply optional filters
    if (query.status) {
      queryBuilder.andWhere('purchaseOrder.status = :status', {
        status: query.status,
      });
    }

    // 6. Get total records
    const total = await queryBuilder.getCount();

    // 7. Apply pagination and sorting
    const purchaseOrders = await queryBuilder
      .orderBy('purchaseOrder.status', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();

    // 8. Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const data: PurchaseOrderResponseDto[] = await Promise.all(
      purchaseOrders.map((purchaseOrder) => {
        const result: any = {
          id: purchaseOrder.id,
          status: purchaseOrder.status,
          totalAmount: purchaseOrder.totalAmount,
          orderDate: purchaseOrder.orderDate,
          merchant: purchaseOrder.merchant
            ? {
                id: purchaseOrder.merchant.id,
                name: purchaseOrder.merchant.name,
              }
            : null,
          supplier: purchaseOrder.supplier
            ? {
                id: purchaseOrder.supplier.id,
                name: purchaseOrder.supplier.name,
                tax_id: purchaseOrder.supplier.tax_id,
                email: purchaseOrder.supplier.email,
                company_id: purchaseOrder.supplier.company_id,
              }
            : null,
          purchaseOrderItems: (purchaseOrder.purchaseOrderItems || []).map(item => ({
            id: item.id,
            quantity: item.quantity,
            receivedQuantity: item.receivedQuantity || 0,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            productId: item.productId,
            variantId: item.variantId,
            rawMaterialId: item.rawMaterialId,
            purchaseUnit: item.purchaseUnit,
            quantityOrdered: item.quantityOrdered,
            unitCost: item.unitCost,
            taxAmount: item.taxAmount,
          })),
        };
        return result;
      }),
    );

    return {
      statusCode: 200,
      message: 'Purchase Orders retrieved successfully',
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
  ): Promise<OnePurchaseOrderResponse> {
    if (!id || id <= 0) {
      ErrorHandler.invalidId('Purchase Order ID incorrect');
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

    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: whereCondition,
      relations: [
        'merchant',
        'supplier',
        'purchaseOrderItems',
        'purchaseOrderItems.product',
        'purchaseOrderItems.variant',
        'purchaseOrderItems.rawMaterial',
        'purchaseOrderItems.location'
      ],
    });

    if (!purchaseOrder)
      ErrorHandler.notFound(ErrorMessage.PURCHASE_ORDER_NOT_FOUND);

    const result: any = {
      id: purchaseOrder.id,
      status: purchaseOrder.status,
      totalAmount: purchaseOrder.totalAmount,
      orderDate: purchaseOrder.orderDate,
      merchant: purchaseOrder.merchant
        ? {
            id: purchaseOrder.merchant.id,
            name: purchaseOrder.merchant.name,
          }
        : null,
      supplier: purchaseOrder.supplier
        ? {
            id: purchaseOrder.supplier.id,
            name: purchaseOrder.supplier.name,
            tax_id: purchaseOrder.supplier.tax_id,
            email: purchaseOrder.supplier.email,
            company_id: purchaseOrder.supplier.company_id,
          }
        : null,
      purchaseOrderItems: (purchaseOrder.purchaseOrderItems || []).map(item => ({
        id: item.id,
        quantity: item.quantity,
        receivedQuantity: item.receivedQuantity || 0,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        productId: item.productId,
        variantId: item.variantId,
        rawMaterialId: item.rawMaterialId,
        purchaseUnit: item.purchaseUnit,
        quantityOrdered: item.quantityOrdered,
        unitCost: item.unitCost,
        taxAmount: item.taxAmount,
        locationId: item.locationId,
        location: item.location ? {
          id: item.location.id,
          name: item.location.name
        } : null,
        product: item.product ? {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku
        } : null,
        variant: item.variant ? {
          id: item.variant.id,
          name: item.variant.name,
          sku: item.variant.sku
        } : null,
        rawMaterial: item.rawMaterial ? {
          id: item.rawMaterial.id,
          name: item.rawMaterial.name,
          sku: item.rawMaterial.sku
        } : null
      }))
    };


    let response: OnePurchaseOrderResponse;

    switch (createdUpdateDelete) {
      case 'Created':
        response = {
          statusCode: 201,
          message: `Purchase Order ${createdUpdateDelete} successfully`,
          data: result,
        };
        break;
      case 'Updated':
        response = {
          statusCode: 200,
          message: `Purchase Order ${createdUpdateDelete} successfully`,
          data: result,
        };
        break;
      case 'Deleted':
        response = {
          statusCode: 200,
          message: `Purchase Order ${createdUpdateDelete} successfully`,
          data: result,
        };
        break;
      default:
        response = {
          statusCode: 200,
          message: 'Purchase Order retrieved successfully',
          data: result,
        };
        break;
    }
    return response;
  }

  async update(
    id: number,
    merchant_id: number,
    updateProductDto: UpdatePurchaseOrderDto,
  ): Promise<OnePurchaseOrderResponse> {
    if (!id || id <= 0) {
      ErrorHandler.invalidId('Purchase Order ID incorrect');
    }
    const { supplierId, ...updateData } = updateProductDto;

    const purchaseOrder = await this.purchaseOrderRepository.findOneBy({
      id,
      isActive: true,
      merchantId: merchant_id,
    });

    if (!purchaseOrder) {
      ErrorHandler.notFound(ErrorMessage.PURCHASE_ORDER_NOT_FOUND);
    }

    if (updateProductDto.isActive === false && purchaseOrder.isActive === true) {
      return this.remove(id, merchant_id);
    }

    if (supplierId && supplierId !== purchaseOrder.supplierId) {
      const merchant = await this.merchantRepository.findOne({
        where: { id: merchant_id },
        select: ['companyId'],
      });
      if (!merchant) ErrorHandler.notFound(ErrorMessage.MERCHANT_NOT_FOUND);

      const supplier = await this.supplierRepository.findOneBy({
        id: supplierId,
        company_id: merchant.companyId,
      });
      if (!supplier) ErrorHandler.notFound(ErrorMessage.SUPPLIER_NOT_FOUND);
    }

    const oldStatus = purchaseOrder.status;

    // Validar transiciones de estado no permitidas (regresiones desde estados recibidos o cancelados)
    if (updateData.status && updateData.status !== oldStatus) {
      if (oldStatus === PurchaseOrderStatus.RECEIVED || oldStatus === PurchaseOrderStatus.CANCELLED) {
        throw new BadRequestException(`Cannot change status of a purchase order that is already ${oldStatus}.`);
      }
      if (oldStatus === PurchaseOrderStatus.PARTIALLY_RECEIVED && (updateData.status === PurchaseOrderStatus.DRAFT || updateData.status === PurchaseOrderStatus.SENT)) {
        throw new BadRequestException('Cannot regress a PARTIALLY_RECEIVED purchase order back to DRAFT or SENT.');
      }
      purchaseOrder.orderDate = new Date();
    }

    // Bloquear actualizaciones de detalles e ítems si no está en DRAFT o SENT
    const hasDetailItemChanges = Array.isArray(updateProductDto.items) && updateProductDto.items.some(it =>
      it.rawMaterialId !== undefined ||
      it.quantityOrdered !== undefined ||
      it.quantity !== undefined ||
      it.unitCost !== undefined ||
      it.unitPrice !== undefined
    );
    const isChangingDetails = hasDetailItemChanges || supplierId !== undefined || updateProductDto.totalAmount !== undefined;

    if (isChangingDetails && oldStatus !== PurchaseOrderStatus.DRAFT && oldStatus !== PurchaseOrderStatus.SENT) {
      throw new BadRequestException('Updates to purchase order details or items are allowed only in DRAFT or SENT states.');
    }



    try {
      // Solo actualizar los campos simples — excluir 'items' del DTO para no contaminar la entidad
      const { items: _items, ...updateEntityData } = updateData as any;
      Object.assign(purchaseOrder, {
        ...updateEntityData,
        // Solo sobreescribir supplierId si viene explícitamente en el payload
        ...(supplierId !== undefined ? { supplierId } : {}),
      });
      await this.purchaseOrderRepository.save(purchaseOrder);

      const targetReceivedStatuses = [PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.COMPLETED, PurchaseOrderStatus.PARTIALLY_RECEIVED];
      const isNowReceived = targetReceivedStatuses.includes(purchaseOrder.status);

      // 1. Si vienen items y el estado es DRAFT o SENT, sincronizamos las líneas de la orden (modificar/agregar/eliminar)
      if (updateProductDto.items && Array.isArray(updateProductDto.items)) {
        let location = await this.locationRepository.findOne({
          where: { merchantId: merchant_id, isActive: true }
        });

        if (!location) {
          location = this.locationRepository.create({
            name: 'Main Warehouse',
            address: 'Default address location',
            merchantId: merchant_id,
            isActive: true
          });
          location = await this.locationRepository.save(location);
        }

        const isDraftOrSent = oldStatus === PurchaseOrderStatus.DRAFT || oldStatus === PurchaseOrderStatus.SENT;
        const isFullGridUpdate = updateProductDto.items.some(it =>
          it.rawMaterialId !== undefined ||
          it.quantityOrdered !== undefined ||
          it.quantity !== undefined ||
          it.unitCost !== undefined ||
          it.unitPrice !== undefined
        );

        if (isDraftOrSent && isFullGridUpdate) {
          const existingItems = await this.purchaseOrderItemRepository.find({
            where: { purchaseOrderId: id, isActive: true }
          });
          const processedItemIds = new Set<number>();
          let recalculatedTotal = 0;

          for (const itemDto of updateProductDto.items) {
            const rawItemId = itemDto.id ? Number(itemDto.id) : null;
            let dbItem = (rawItemId !== null && !isNaN(rawItemId) && rawItemId > 0)
              ? existingItems.find(i => i.id === rawItemId)
              : null;

            if (dbItem) {
              if (itemDto.rawMaterialId) dbItem.rawMaterialId = Number(itemDto.rawMaterialId);
              if (itemDto.purchaseUnit) dbItem.purchaseUnit = itemDto.purchaseUnit;
              if (itemDto.quantityOrdered !== undefined || itemDto.quantity !== undefined) {
                const q = Number(itemDto.quantityOrdered ?? itemDto.quantity);
                dbItem.quantityOrdered = q;
                dbItem.quantity = Math.ceil(q);
              }
              if (itemDto.unitCost !== undefined || itemDto.unitPrice !== undefined) {
                const c = Number(itemDto.unitCost ?? itemDto.unitPrice);
                dbItem.unitCost = c;
                dbItem.unitPrice = c;
              }
              if (itemDto.taxAmount !== undefined) {
                dbItem.taxAmount = Number(itemDto.taxAmount);
              }
              if (itemDto.locationId) {
                dbItem.locationId = Number(itemDto.locationId);
              }

              const itemQty = Number(dbItem.quantityOrdered ?? dbItem.quantity) || 0;
              const itemCost = Number(dbItem.unitCost ?? dbItem.unitPrice) || 0;
              const itemTax = Number(dbItem.taxAmount) || 0;
              dbItem.totalPrice = (itemQty * itemCost) + itemTax;
              recalculatedTotal += dbItem.totalPrice;

              dbItem = await this.purchaseOrderItemRepository.save(dbItem);
              processedItemIds.add(dbItem.id);
            } else {
              const qtyOrdered = Number(itemDto.quantityOrdered ?? itemDto.quantity) || 0;
              const cost = Number(itemDto.unitCost ?? itemDto.unitPrice) || 0;
              const tax = Number(itemDto.taxAmount) || 0;
              const totalPrice = (qtyOrdered * cost) + tax;
              recalculatedTotal += totalPrice;

              const newItem = this.purchaseOrderItemRepository.create({
                purchaseOrderId: id,
                rawMaterialId: itemDto.rawMaterialId ? Number(itemDto.rawMaterialId) : null,
                productId: itemDto.productId ? Number(itemDto.productId) : null,
                variantId: itemDto.variantId ? Number(itemDto.variantId) : null,
                purchaseUnit: itemDto.purchaseUnit || 'unit',
                quantityOrdered: qtyOrdered,
                quantity: Math.ceil(qtyOrdered),
                unitCost: cost,
                unitPrice: cost,
                taxAmount: tax,
                totalPrice: totalPrice,
                locationId: itemDto.locationId ? Number(itemDto.locationId) : location.id,
                receivedQuantity: 0,
                isActive: true
              });
              const savedItem = await this.purchaseOrderItemRepository.save(newItem);
              processedItemIds.add(savedItem.id);
            }
          }

          // Eliminar los ítems removidos en la edición
          for (const oldItem of existingItems) {
            if (!processedItemIds.has(oldItem.id)) {
              await this.purchaseOrderItemRepository.remove(oldItem);
            }
          }

          // Actualizar el totalAmount de la orden
          purchaseOrder.totalAmount = updateProductDto.totalAmount !== undefined 
            ? updateProductDto.totalAmount 
            : recalculatedTotal;
          await this.purchaseOrderRepository.save(purchaseOrder);
        }


        // 2. Si updateProductDto contiene ítems con receivedQuantity, procesar mediante receiveOrderItems para evitar duplicación
        if (Array.isArray(updateProductDto.items) && updateProductDto.items.some(i => i.receivedQuantity !== undefined)) {
          const receiveDto = {
            items: updateProductDto.items.map(i => ({
              id: Number(i.id),
              receivedQuantity: Number(i.receivedQuantity) || 0
            }))
          };
          return await this.receiveOrderItems(id, merchant_id, receiveDto);
        }
      }

      return this.findOne(id, merchant_id, 'Updated');



      return this.findOne(id, merchant_id, 'Updated');
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      ErrorHandler.handleDatabaseError(error);
    }
  }

  private async increaseStockForOrder(purchaseOrderId: number, merchantId: number, status: PurchaseOrderStatus) {
    const orderItems = await this.purchaseOrderItemRepository.find({
      where: { purchaseOrderId, isActive: true }
    });

    if (orderItems.length > 0) {
      let defaultLocation = await this.locationRepository.findOne({
        where: { merchantId, isActive: true }
      });

      if (!defaultLocation) {
        defaultLocation = this.locationRepository.create({
          name: 'Main Warehouse',
          address: 'Default address location',
          merchantId,
          isActive: true
        });
        defaultLocation = await this.locationRepository.save(defaultLocation);
      }

      for (const item of orderItems) {
        const oldReceived = Number(item.receivedQuantity) || 0;
        const ordered = Number(item.quantityOrdered || item.quantity) || 0;
        const maxCanReceive = Math.max(0, ordered - oldReceived);

        // Para COMPLETED / RECEIVED: el total a recibir es el quantityOrdered/quantity; diff es lo pendiente de recibir
        const targetCompleted = status === PurchaseOrderStatus.COMPLETED || status === PurchaseOrderStatus.RECEIVED;
        const newReceived = targetCompleted ? ordered : oldReceived;
        const diff = Math.min(newReceived - oldReceived, maxCanReceive);

        if (diff > 0) {
          item.receivedQuantity = oldReceived + diff;
          await this.purchaseOrderItemRepository.save(item);


          const targetLocationId = item.locationId || defaultLocation.id;

          const whereClause: any = {
            locationId: targetLocationId
          };
          if (item.rawMaterialId) {
            whereClause.supplyId = item.rawMaterialId;
          } else {
            whereClause.productId = item.productId;
            if (item.variantId) {
              whereClause.variantId = item.variantId;
            } else {
              whereClause.variantId = IsNull();
            }
          }

          const stockItem = await this.itemRepository.findOne({
            where: whereClause
          });

          if (stockItem) {
            stockItem.currentQty = Number(stockItem.currentQty) + diff;
            stockItem.isActive = true;
            await this.itemRepository.save(stockItem);

            await this.movementsService.create(merchantId, {
              stockItemId: stockItem.id,
              quantity: diff,
              type: MovementsStatus.IN,
              reference: `PO-${purchaseOrderId}`,
              reason: `Fulfillment of Purchase Order #${purchaseOrderId}`,
              movementType: 'PURCHASE_RECEIPT',
            });
          } else {
            const createData: DeepPartial<Item> = {
              locationId: targetLocationId,
              currentQty: diff,
              isActive: true
            };
            if (item.rawMaterialId) {
              createData.supplyId = item.rawMaterialId;
            } else {
              createData.productId = item.productId;
              if (item.variantId) {
                createData.variantId = item.variantId;
              }
            }
            const newStockItem = this.itemRepository.create(createData);
            const savedStockItem = await this.itemRepository.save(newStockItem);

            await this.movementsService.create(merchantId, {
              stockItemId: savedStockItem.id,
              quantity: diff,
              type: MovementsStatus.IN,
              reference: `PO-${purchaseOrderId}`,
              reason: `Fulfillment of Purchase Order #${purchaseOrderId}`,
              movementType: 'PURCHASE_RECEIPT',
            });
          }
        }
      }
    }
  }

  async remove(
    id: number,
    merchant_id: number,
  ): Promise<OnePurchaseOrderResponse> {
    if (!id || id <= 0) {
      ErrorHandler.invalidId('Purchase Order ID incorrect');
    }
    const purchaseOrder = await this.purchaseOrderRepository.findOneBy({
      id,
      isActive: true,
      merchantId: merchant_id,
    });

    if (!purchaseOrder)
      ErrorHandler.notFound(ErrorMessage.PURCHASE_ORDER_NOT_FOUND);

    try {
      purchaseOrder.isActive = false;
      await this.purchaseOrderRepository.save(purchaseOrder);

      const purchaseOrderItems = await this.purchaseOrderItemRepository.find({
        where: { purchaseOrderId: id, isActive: true },
      });

      for (const item of purchaseOrderItems) {
        item.isActive = false;
        await this.purchaseOrderItemRepository.save(item);
      }

      return this.findOne(id, merchant_id, 'Deleted');
    } catch (error) {
      ErrorHandler.handleDatabaseError(error);
    }
  }

  async receiveOrderItems(
    id: number,
    merchantId: number,
    dto: ReceiveItemsDto,
    creatorEmail?: string,
  ): Promise<OnePurchaseOrderResponse> {
    const purchaseOrder = await this.purchaseOrderRepository.findOne({
      where: { id, merchantId, isActive: true },
      relations: ['purchaseOrderItems'],
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase Order with ID ${id} not found`);
    }

    const validStatuses = [PurchaseOrderStatus.SENT, PurchaseOrderStatus.PARTIALLY_RECEIVED];
    if (!validStatuses.includes(purchaseOrder.status)) {
      throw new BadRequestException(`Cannot receive items for purchase order in status ${purchaseOrder.status}`);
    }

    let defaultLocation = await this.locationRepository.findOne({
      where: { merchantId, isActive: true },
    });

    if (!defaultLocation) {
      defaultLocation = this.locationRepository.create({
        name: 'Main Warehouse',
        address: 'Default address location',
        merchantId,
        isActive: true,
      });
      defaultLocation = await this.locationRepository.save(defaultLocation);
    }

    const evaluatedStockIds = new Set<number>();

    for (const receiveLine of dto.items) {
      const itemLine = purchaseOrder.purchaseOrderItems.find(
        (poi) => poi.id === receiveLine.id && poi.isActive,
      );

      if (!itemLine) {
        throw new NotFoundException(`Purchase order item with ID ${receiveLine.id} not found on this order`);
      }

      const oldReceived = Number(itemLine.receivedQuantity) || 0;
      const ordered = Number(itemLine.quantityOrdered || itemLine.quantity) || 0;
      const maxCanReceive = Math.max(0, ordered - oldReceived);

      let additionalReceived = Number(receiveLine.receivedQuantity) || 0;
      if (additionalReceived > maxCanReceive) {
        additionalReceived = maxCanReceive;
      }

      if (additionalReceived <= 0) {
        continue;
      }

      const targetReceived = oldReceived + additionalReceived;

      // Guardar el nuevo acumulado recibido en el ítem de la orden de compra
      itemLine.receivedQuantity = targetReceived;
      await this.purchaseOrderItemRepository.save(itemLine);


      const targetLocationId = itemLine.locationId || defaultLocation.id;

      // Buscar o crear el stock_item para el ingrediente/producto
      const whereClause: any = { locationId: targetLocationId };
      if (itemLine.rawMaterialId) {
        whereClause.supplyId = itemLine.rawMaterialId;
      } else {
        whereClause.productId = itemLine.productId;
        if (itemLine.variantId) {
          whereClause.variantId = itemLine.variantId;
        } else {
          whereClause.variantId = IsNull();
        }
      }

      let stockItem = await this.itemRepository.findOne({
        where: whereClause,
      });

      if (!stockItem) {
        const createData: DeepPartial<Item> = {
          locationId: targetLocationId,
          currentQty: 0,
          isActive: true,
          weightedAverageUnitCost: '0.0000',
        };
        if (itemLine.rawMaterialId) {
          createData.supplyId = itemLine.rawMaterialId;
        } else {
          createData.productId = itemLine.productId;
          if (itemLine.variantId) {
            createData.variantId = itemLine.variantId;
          }
        }
        stockItem = this.itemRepository.create(createData);
        stockItem = await this.itemRepository.save(stockItem);
      }

      const oldQty = Number(stockItem.currentQty) || 0;
      const oldWacc = Number(stockItem.weightedAverageUnitCost) || 0;
      const purchaseCost = Number(itemLine.unitCost || itemLine.unitPrice) || 0;

      // Calcular nuevo WACC
      let newWacc = oldWacc;
      const newTotalQty = oldQty + additionalReceived;
      if (newTotalQty > 0) {
        newWacc = ((oldQty * oldWacc) + (additionalReceived * purchaseCost)) / newTotalQty;
      }

      // Actualizar el stock físico
      stockItem.currentQty = newTotalQty;
      stockItem.weightedAverageUnitCost = newWacc.toFixed(4);
      await this.itemRepository.save(stockItem);
      evaluatedStockIds.add(stockItem.id);

      // Si es materia prima, actualizar el cost_per_unit en Supplies
      if (itemLine.rawMaterialId) {
        const supply = await this.supplyRepository.findOneBy({ id: itemLine.rawMaterialId });
        if (supply) {
          supply.cost_per_unit = purchaseCost;
          await this.supplyRepository.save(supply);
        }
      }

      // Crear el movimiento auditado
      const movement = this.movementRepository.create({
        stockItemId: stockItem.id,
        quantity: additionalReceived,
        type: MovementsStatus.IN,
        reference: `PO-${id}`,
        reason: `Receipt of items against PO #${id}`,
        merchantId,
        isActive: true,
        sourceLocationId: null,
        destinationLocationId: targetLocationId,
        createdBy: creatorEmail || 'Receiving Clerk',
        movementType: 'PURCHASE_RECEIPT',
      });
      await this.movementRepository.save(movement);
    }

    // Determinar nuevo estado de la orden
    let allReceived = true;
    let anyReceived = false;

    for (const item of purchaseOrder.purchaseOrderItems) {
      if (item.isActive) {
        const ordered = Number(item.quantityOrdered || item.quantity) || 0;
        const received = Number(item.receivedQuantity) || 0;

        if (received < ordered) {
          allReceived = false;
        }
        if (received > 0) {
          anyReceived = true;
        }
      }
    }

    if (allReceived) {
      purchaseOrder.status = PurchaseOrderStatus.RECEIVED;
    } else if (anyReceived) {
      purchaseOrder.status = PurchaseOrderStatus.PARTIALLY_RECEIVED;
    }

    await this.purchaseOrderRepository.save(purchaseOrder);

    if (evaluatedStockIds.size > 0) {
      await this.stockLevelMonitor.evaluateStockItems(merchantId, Array.from(evaluatedStockIds));
    }

    return this.findOne(id, merchantId, 'Updated');
  }
}
