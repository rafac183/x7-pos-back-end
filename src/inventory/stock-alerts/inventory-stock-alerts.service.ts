import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryStockAlert } from './entities/inventory-stock-alert.entity';
import { InventoryStockAlertStatus } from './constants/inventory-stock-alert-status.enum';
import type { GetInventoryStockAlertsQueryDto } from './dto/get-inventory-stock-alerts-query.dto';
import type { InventoryStockAlertResponseDto } from './dto/inventory-stock-alert-response.dto';

@Injectable()
export class InventoryStockAlertsService {
  constructor(
    @InjectRepository(InventoryStockAlert)
    private readonly alertRepo: Repository<InventoryStockAlert>,
  ) {}

  private toDto(row: InventoryStockAlert): InventoryStockAlertResponseDto {
    return {
      id: row.id,
      merchantId: row.merchantId,
      stockItemId: row.stockItemId,
      productId: row.productId,
      variantId: row.variantId,
      supplyId: row.supplyId,
      locationId: row.locationId,
      categoryId: row.categoryId,
      alertType: row.alertType,
      currentQty: row.currentQty,
      minimumQty: row.minimumQty,
      status: row.status,
      triggeredAt: row.triggeredAt,
      resolvedAt: row.resolvedAt,
      emailSentAt: row.emailSentAt,
      productName: row.product?.name ?? row.supply?.name ?? null,
      variantName: row.variant?.name ?? null,
      locationName: row.location?.name ?? null,
      categoryName: row.product?.category?.name ?? null,
    };
  }

  async findAll(
    merchantId: number,
    query: GetInventoryStockAlertsQueryDto,
  ): Promise<{
    data: InventoryStockAlertResponseDto[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const status = query.status ?? InventoryStockAlertStatus.ACTIVE;

    const qb = this.alertRepo
      .createQueryBuilder('alert')
      .leftJoinAndSelect('alert.product', 'product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('alert.variant', 'variant')
      .leftJoinAndSelect('alert.location', 'location')
      .leftJoinAndSelect('alert.supply', 'supply')
      .where('alert.merchantId = :merchantId', { merchantId })
      .andWhere('alert.status = :status', { status });

    if (query.categoryId != null) {
      qb.andWhere('alert.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.alertType != null) {
      qb.andWhere('alert.alertType = :alertType', {
        alertType: query.alertType,
      });
    }

    qb.orderBy('alert.triggeredAt', 'DESC');

    const total = await qb.getCount();
    const rows = await qb.skip(skip).take(limit).getMany();
    const totalPages = Math.ceil(total / limit);

    return {
      data: rows.map((r) => this.toDto(r)),
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async acknowledge(
    merchantId: number,
    alertId: number,
  ): Promise<InventoryStockAlertResponseDto> {
    const row = await this.alertRepo.findOne({
      where: { id: alertId, merchantId },
      relations: ['product', 'product.category', 'variant', 'location', 'supply'],
    });
    if (!row) {
      throw new NotFoundException('Inventory stock alert not found');
    }
    if (row.status === InventoryStockAlertStatus.RESOLVED) {
      return this.toDto(row);
    }
    row.status = InventoryStockAlertStatus.RESOLVED;
    row.resolvedAt = new Date();
    const saved = await this.alertRepo.save(row);
    return this.toDto(saved);
  }
}
