import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Item } from '../products-inventory/stocks/items/entities/item.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';

export type VariantStockAvailability = {
  isOutOfStock: boolean;
  isLowStock: boolean;
};

export type ProductStockAvailability = {
  isOutOfStock: boolean;
  isLowStock: boolean;
};

@Injectable()
export class StockAvailabilityService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
  ) {}

  private variantAvailabilityFromItem(item: Item): VariantStockAvailability {
    const qty = item.currentQty;
    const min = item.minimumQty;
    const isOutOfStock = qty <= 0;
    const isLowStock = !isOutOfStock && min != null && qty > 0 && qty <= min;
    return { isOutOfStock, isLowStock };
  }

  async getDefaultSalesLocationId(merchantId: number): Promise<number | null> {
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
      select: ['id', 'defaultSalesStockLocationId'],
    });
    return merchant?.defaultSalesStockLocationId ?? null;
  }

  async getVariantAvailability(
    merchantId: number,
    variantId: number,
    locationId?: number | null,
  ): Promise<VariantStockAvailability | null> {
    const locId =
      locationId ?? (await this.getDefaultSalesLocationId(merchantId));
    if (locId == null) {
      return null;
    }

    const item = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.product', 'product')
      .where('item.variantId = :variantId', { variantId })
      .andWhere('item.locationId = :locationId', { locationId: locId })
      .andWhere('item.isActive = :ia', { ia: true })
      .andWhere('product.merchantId = :merchantId', { merchantId })
      .getOne();

    if (!item) {
      return null;
    }
    return this.variantAvailabilityFromItem(item);
  }

  async getProductAvailabilityMap(
    merchantId: number,
    productIds: number[],
  ): Promise<Map<number, ProductStockAvailability>> {
    const result = new Map<number, ProductStockAvailability>();
    if (productIds.length === 0) {
      return result;
    }

    const locationId = await this.getDefaultSalesLocationId(merchantId);
    if (locationId == null) {
      for (const pid of productIds) {
        result.set(pid, { isOutOfStock: false, isLowStock: false });
      }
      return result;
    }

    const items = await this.itemRepo
      .createQueryBuilder('item')
      .innerJoin('item.product', 'product')
      .where('item.productId IN (:...productIds)', { productIds })
      .andWhere('item.locationId = :locationId', { locationId })
      .andWhere('item.isActive = :ia', { ia: true })
      .andWhere('product.merchantId = :merchantId', { merchantId })
      .getMany();

    const byProduct = new Map<number, Item[]>();
    for (const item of items) {
      if (item.productId != null) {
        const list = byProduct.get(item.productId) ?? [];
        list.push(item);
        byProduct.set(item.productId, list);
      }
    }

    for (const pid of productIds) {
      const rows = byProduct.get(pid);
      if (!rows || rows.length === 0) {
        result.set(pid, { isOutOfStock: false, isLowStock: false });
        continue;
      }
      const variantFlags = rows.map((r) => this.variantAvailabilityFromItem(r));
      const isOutOfStock = variantFlags.every((v) => v.isOutOfStock);
      const isLowStock = variantFlags.some((v) => v.isLowStock);
      result.set(pid, { isOutOfStock, isLowStock });
    }

    return result;
  }

  async getVariantAvailabilityMap(
    merchantId: number,
    variantIds: number[],
  ): Promise<Map<number, VariantStockAvailability>> {
    const result = new Map<number, VariantStockAvailability>();
    if (variantIds.length === 0) {
      return result;
    }

    const locationId = await this.getDefaultSalesLocationId(merchantId);
    if (locationId == null) {
      return result;
    }

    const items = await this.itemRepo.find({
      where: {
        variantId: In(variantIds),
        locationId,
        isActive: true,
      },
      relations: ['product'],
    });

    for (const item of items) {
      if (item.product?.merchantId !== merchantId) {
        continue;
      }
      if (item.variantId != null) {
        result.set(item.variantId, this.variantAvailabilityFromItem(item));
      }
    }
    return result;
  }
}
