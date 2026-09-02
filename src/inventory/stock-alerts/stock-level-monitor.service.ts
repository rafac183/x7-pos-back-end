import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Item } from '../products-inventory/stocks/items/entities/item.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { InventoryStockAlert } from './entities/inventory-stock-alert.entity';
import { InventoryStockAlertType } from './constants/inventory-stock-alert-type.enum';
import { InventoryStockAlertStatus } from './constants/inventory-stock-alert-status.enum';
import {
  INVENTORY_STOCK_ALERT_EVENT,
  type InventoryStockAlertPayload,
} from './inventory-stock.events';

type StockLevelState = 'OK' | InventoryStockAlertType;

function computeStockLevelState(
  currentQty: number,
  minimumQty: number | null,
): StockLevelState {
  if (currentQty <= 0) {
    return InventoryStockAlertType.OUT_OF_STOCK;
  }
  if (minimumQty != null && currentQty < minimumQty) {
    return InventoryStockAlertType.LOW;
  }
  return 'OK';
}

@Injectable()
export class StockLevelMonitorService {
  private readonly logger = new Logger(StockLevelMonitorService.name);

  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(InventoryStockAlert)
    private readonly alertRepo: Repository<InventoryStockAlert>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async evaluateStockItems(
    merchantId: number,
    stockItemIds: number[],
  ): Promise<void> {
    const uniqueIds = [...new Set(stockItemIds.filter((id) => id > 0))];
    if (uniqueIds.length === 0) {
      return;
    }

    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
      select: ['id', 'companyId'],
    });
    if (!merchant) {
      return;
    }

    const items = await this.itemRepo.find({
      where: { id: In(uniqueIds), isActive: true },
      relations: ['product', 'variant', 'location', 'supply'],
    });

    for (const item of items) {
      if (item.product && item.product.merchantId !== merchantId) {
        continue;
      }
      if (item.supply && item.supply.company_id !== merchant.companyId) {
        continue;
      }
      try {
        await this.evaluateOneItem(merchant.companyId, merchantId, item);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        this.logger.error(
          `Stock level evaluation failed for stockItemId=${item.id}: ${err.message}`,
          err.stack,
        );
      }
    }
  }

  private async evaluateOneItem(
    companyId: number,
    merchantId: number,
    item: Item,
  ): Promise<void> {
    const currentQty = item.currentQty;
    const minimumQty = item.minimumQty ?? null;
    const newState = computeStockLevelState(currentQty, minimumQty);

    const activeAlerts = await this.alertRepo.find({
      where: {
        stockItemId: item.id,
        status: InventoryStockAlertStatus.ACTIVE,
      },
    });

    const previousState = this.previousStateFromAlerts(activeAlerts);
    if (previousState === newState) {
      return;
    }

    const now = new Date();
    await this.resolveActiveAlerts(item.id, now);

    if (newState === 'OK') {
      return;
    }

    const saved = await this.alertRepo.save(
      this.alertRepo.create({
        merchantId,
        stockItemId: item.id,
        productId: item.productId ?? null,
        variantId: item.variantId ?? null,
        supplyId: item.supplyId ?? null,
        locationId: item.locationId,
        categoryId: item.product?.categoryId ?? item.supply?.category_id ?? null,
        alertType: newState,
        currentQty,
        minimumQty,
        status: InventoryStockAlertStatus.ACTIVE,
        triggeredAt: now,
        resolvedAt: null,
        emailSentAt: null,
      } as Partial<InventoryStockAlert>),
    );

    const payload: InventoryStockAlertPayload = {
      alertId: saved.id,
      companyId,
      merchantId,
      stockItemId: item.id,
      productId: item.productId ?? null,
      variantId: item.variantId ?? null,
      supplyId: item.supplyId ?? null,
      locationId: item.locationId,
      categoryId: item.product?.categoryId ?? item.supply?.category_id ?? null,
      alertType: newState,
      currentQty,
      minimumQty,
      productName: item.product?.name ?? item.supply?.name ?? '',
      variantName: item.variant?.name ?? '',
      locationName: item.location?.name ?? '',
    };

    this.eventEmitter.emit(INVENTORY_STOCK_ALERT_EVENT, payload);
  }

  private previousStateFromAlerts(
    active: InventoryStockAlert[],
  ): StockLevelState {
    if (
      active.some((a) => a.alertType === InventoryStockAlertType.OUT_OF_STOCK)
    ) {
      return InventoryStockAlertType.OUT_OF_STOCK;
    }
    if (active.some((a) => a.alertType === InventoryStockAlertType.LOW)) {
      return InventoryStockAlertType.LOW;
    }
    return 'OK';
  }

  private async resolveActiveAlerts(
    stockItemId: number,
    resolvedAt: Date,
  ): Promise<void> {
    await this.alertRepo.update(
      { stockItemId, status: InventoryStockAlertStatus.ACTIVE },
      { status: InventoryStockAlertStatus.RESOLVED, resolvedAt },
    );
  }
}
