import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { Order } from 'src/restaurant-operations/pos/orders/entities/order.entity';
import { OrderItem } from 'src/restaurant-operations/pos/order-item/entities/order-item.entity';
import { OrderItemModifier } from 'src/restaurant-operations/pos/order-item-modifiers/entities/order-item-modifier.entity';
import { OrderItemStatus } from 'src/restaurant-operations/pos/order-item/constants/order-item-status.enum';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { ProductRecipe } from 'src/inventory/products-inventory/recipes/entities/product-recipe.entity';
import { RecipeLineType } from 'src/inventory/products-inventory/recipes/constants/recipe-line-type.enum';
import { stockIncrementsForRecipeLine } from 'src/inventory/products-inventory/recipes/utils/recipe-unit-conversion.util';
import { recipeLineShouldDeduct } from 'src/inventory/products-inventory/recipes/utils/recipe-deduction-rules.util';
import { Item } from 'src/inventory/products-inventory/stocks/items/entities/item.entity';
import { Movement } from 'src/inventory/products-inventory/stocks/movements/entities/movement.entity';
import { MovementsStatus } from 'src/inventory/products-inventory/stocks/movements/constants/movements-status';
import { Location } from 'src/inventory/products-inventory/stocks/locations/entities/location.entity';
import { CashTransaction } from 'src/restaurant-operations/cashdrawer/cash-transactions/entities/cash-transaction.entity';
import { CashTransactionType } from 'src/restaurant-operations/cashdrawer/cash-transactions/constants/cash-transaction-type.enum';
import { CashDrawer } from 'src/restaurant-operations/cashdrawer/cash-drawers/entities/cash-drawer.entity';
import type { OrderFullyPaidPayload } from './order-paid.events';
import { StockLevelMonitorService } from '../stock-alerts/stock-level-monitor.service';

type SupplyKey = string;

function supplyKey(productId: number, variantId: number): SupplyKey {
  return `product:${productId}:${variantId}`;
}

function pickRecipeForLine(
  recipes: ProductRecipe[],
  lineVariantId: number | null,
): ProductRecipe | null {
  if (lineVariantId != null) {
    const exact = recipes.find((r) => r.finishedVariantId === lineVariantId);
    if (exact) {
      return exact;
    }
  }
  return recipes.find((r) => r.finishedVariantId === null) ?? null;
}

@Injectable()
export class SaleInventoryDeductionService {
  private readonly logger = new Logger(SaleInventoryDeductionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly stockLevelMonitor: StockLevelMonitorService,
  ) {}

  async processOrderFullyPaid(payload: OrderFullyPaidPayload): Promise<void> {
    const { orderId } = payload;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const claim = await queryRunner.manager
        .createQueryBuilder()
        .update(Order)
        .set({ inventory_consumed_at: new Date() })
        .where('id = :orderId', { orderId })
        .andWhere('inventory_consumed_at IS NULL')
        .andWhere('is_paid = :paid', { paid: true })
        .execute();

      if (!claim.affected) {
        await queryRunner.rollbackTransaction();
        return;
      }

      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
        relations: ['merchant'],
      });
      if (!order) {
        await queryRunner.rollbackTransaction();
        return;
      }

      const merchant = await queryRunner.manager.findOne(Merchant, {
        where: { id: order.merchant_id },
        select: ['id', 'defaultSalesStockLocationId', 'companyId'],
      });
      const locationId = merchant?.defaultSalesStockLocationId ?? null;
      if (locationId == null) {
        this.logger.error(
          `Checkout inventory deduction skipped: default sales stock location is not configured for merchantId=${order.merchant_id} orderId=${orderId}`,
        );
        await queryRunner.manager.update(
          Order,
          { id: orderId },
          { inventory_consumed_at: null },
        );
        await queryRunner.commitTransaction();
        return;
      }

      const location = await queryRunner.manager.findOne(Location, {
        where: { id: locationId, isActive: true },
      });
      if (!location || location.merchantId !== order.merchant_id) {
        this.logger.error(
          `Checkout inventory deduction skipped: default sales stock location ${locationId} is missing or not owned by merchantId=${order.merchant_id} orderId=${orderId}`,
        );
        await queryRunner.manager.update(
          Order,
          { id: orderId },
          { inventory_consumed_at: null },
        );
        await queryRunner.commitTransaction();
        return;
      }

      const items = await queryRunner.manager.find(OrderItem, {
        where: { order_id: orderId, status: OrderItemStatus.ACTIVE },
      });

      const orderItemIds = [...new Set(items.map((i) => i.id))];
      const modifierRows =
        orderItemIds.length > 0
          ? await queryRunner.manager.find(OrderItemModifier, {
              where: { order_item_id: In(orderItemIds) },
            })
          : [];
      const modifiersByOrderItemId = new Map<number, Set<number>>();
      for (const m of modifierRows) {
        const set =
          modifiersByOrderItemId.get(m.order_item_id) ?? new Set<number>();
        set.add(m.modifier_id);
        modifiersByOrderItemId.set(m.order_item_id, set);
      }

      const recipesByProduct = new Map<number, ProductRecipe[]>();
      const productIds = [...new Set(items.map((i) => i.product_id))];
      if (productIds.length > 0) {
        const allRecipes = await queryRunner.manager.find(ProductRecipe, {
          where: {
            merchantId: order.merchant_id,
            finishedProductId: In(productIds),
          },
          relations: ['lines', 'lines.supplyVariant', 'lines.rawMaterial'],
        });
        for (const r of allRecipes) {
          const list = recipesByProduct.get(r.finishedProductId) ?? [];
          list.push(r);
          recipesByProduct.set(r.finishedProductId, list);
        }
      }

      const aggregated = new Map<SupplyKey, number>();

      for (const line of items) {
        const candidates = recipesByProduct.get(line.product_id) ?? [];
        const recipe = pickRecipeForLine(candidates, line.variant_id);
        if (!recipe || !recipe.lines?.length) {
          this.logger.error(
            `Sale recorded without recipe: orderId=${orderId} productId=${line.product_id} variantId=${line.variant_id ?? 'null'}`,
          );
          continue;
        }
        const soldQty = Number(line.quantity);
        const modSet = modifiersByOrderItemId.get(line.id) ?? new Set<number>();
        for (const row of recipe.lines) {
          const lineType = row.lineType ?? RecipeLineType.REQUIRED;
          if (
            !recipeLineShouldDeduct(lineType, row.modifierId ?? null, modSet)
          ) {
            continue;
          }

          if (row.rawMaterialId) {
            // Raw material line
            const per = Number(row.quantity) || Number(row.quantityPerSoldUnit) || 0;
            const units = Math.round(soldQty * per);
            const key = `supply:${row.rawMaterialId}`;
            aggregated.set(key, (aggregated.get(key) ?? 0) + units);
          } else {
            // Legacy product/variant line
            const per = Number(row.quantityPerSoldUnit);
            const units = stockIncrementsForRecipeLine(
              per,
              row.quantityUnit,
              soldQty,
              row.supplyVariant?.stockBasisKind,
              row.supplyVariant?.baseUnitsPerStockIncrement,
            );
            const key = supplyKey(row.supplyProductId as number, row.supplyVariantId as number);
            aggregated.set(key, (aggregated.get(key) ?? 0) + units);
          }
        }
      }

      const shiftId =
        payload.shiftId ??
        (await this.resolveShiftIdFromCashSales(queryRunner.manager, orderId));

      const affectedStockItemIds: number[] = [];

      for (const [key, needQty] of aggregated) {
        if (needQty <= 0) {
          continue;
        }

        let stockItem: Item | null = null;

        if (key.startsWith('supply:')) {
          const supplyId = Number(key.split(':')[1]);
          stockItem = await queryRunner.manager
            .createQueryBuilder(Item, 'item')
            .innerJoin('item.supply', 'supply')
            .where('item.supplyId = :supplyId', { supplyId })
            .andWhere('item.locationId = :locationId', { locationId })
            .andWhere('item.isActive = :ia', { ia: true })
            .andWhere('supply.company_id = :companyId', {
              companyId: merchant?.companyId,
            })
            .getOne();

          if (!stockItem) {
            throw new Error(
              `No active stock item for raw material supplyId=${supplyId} at locationId=${locationId} (orderId=${orderId})`,
            );
          }
        } else {
          const parts = key.split(':');
          const supplyProductId = Number(parts[1]);
          const supplyVariantId = Number(parts[2]);

          stockItem = await queryRunner.manager
            .createQueryBuilder(Item, 'item')
            .innerJoin('item.product', 'product')
            .where('item.productId = :supplyProductId', { supplyProductId })
            .andWhere('item.variantId = :supplyVariantId', { supplyVariantId })
            .andWhere('item.locationId = :locationId', { locationId })
            .andWhere('item.isActive = :ia', { ia: true })
            .andWhere('product.merchantId = :merchantId', {
              merchantId: order.merchant_id,
            })
            .getOne();

          if (!stockItem) {
            throw new Error(
              `No active stock item for supply productId=${supplyProductId} variantId=${supplyVariantId} at locationId=${locationId} (orderId=${orderId})`,
            );
          }
        }

        const dec = await queryRunner.manager
          .createQueryBuilder()
          .update(Item)
          .set({
            currentQty: () => `"currentQty" - ${needQty}`,
          })
          .where('id = :id', { id: stockItem.id })
          .andWhere('"currentQty" >= :need', { need: needQty })
          .execute();

        if (!dec.affected) {
          const label = key.startsWith('supply:') ? `raw material supplyId=${key.split(':')[1]}` : `productId=${key.split(':')[1]} variantId=${key.split(':')[2]}`;
          throw new Error(
            `Insufficient stock for ${label} at locationId=${locationId} need=${needQty} (orderId=${orderId})`,
          );
        }

        const movement = queryRunner.manager.create(Movement, {
          stockItemId: stockItem.id,
          quantity: needQty,
          type: MovementsStatus.OUT_FOR_SALE,
          reference: `order:${orderId}`,
          reason: 'Checkout sale (recipe consumption)',
          merchantId: order.merchant_id,
          orderId,
          shiftId,
          isActive: true,
        });
        await queryRunner.manager.save(Movement, movement);
        affectedStockItemIds.push(stockItem.id);
      }

      await queryRunner.commitTransaction();

      await this.stockLevelMonitor.evaluateStockItems(
        order.merchant_id,
        affectedStockItemIds,
      );
    } catch (e) {
      await queryRunner.rollbackTransaction();
      const err = e instanceof Error ? e : new Error(String(e));
      this.logger.error(
        `Checkout inventory deduction failed for orderId=${orderId}: ${err.message}`,
        err.stack,
      );
      await this.dataSource.manager.update(
        Order,
        { id: orderId },
        { inventory_consumed_at: null },
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async resolveShiftIdFromCashSales(
    manager: EntityManager,
    orderId: number,
  ): Promise<number | null> {
    const row = await manager
      .createQueryBuilder(CashTransaction, 'ct')
      .innerJoin(CashDrawer, 'cd', 'cd.id = ct.cash_drawer_id')
      .select('cd.shift_id', 'shiftId')
      .where('ct.order_id = :orderId', { orderId })
      .andWhere('ct.type = :sale', { sale: CashTransactionType.SALE })
      .orderBy('ct.created_at', 'DESC')
      .limit(1)
      .getRawOne<{ shiftId: number } | undefined>();
    return row?.shiftId ?? null;
  }
}
