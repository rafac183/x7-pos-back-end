import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SupplierPaymentItem } from './entities/supplier-payment-item.entity';
import { SupplierPayment } from '../supplier-payments/entities/supplier-payment.entity';
import { SupplierPaymentStatus } from '../supplier-payments/constants/supplier-payment-status.enum';
import { CreateSupplierPaymentItemDto } from './dto/create-supplier-payment-item.dto';
import { UpdateSupplierPaymentItemDto } from './dto/update-supplier-payment-item.dto';
import {
  GetSupplierPaymentItemsQueryDto,
  SupplierPaymentItemSortBy,
} from './dto/get-supplier-payment-items-query.dto';
import {
  OneSupplierPaymentItemResponseDto,
  SupplierPaymentItemResponseDto,
} from './dto/supplier-payment-item-response.dto';
import { PaginatedSupplierPaymentItemsResponseDto } from './dto/paginated-supplier-payment-items-response.dto';

@Injectable()
export class SupplierPaymentItemsService {
  constructor(
    @InjectRepository(SupplierPaymentItem)
    private readonly itemRepo: Repository<SupplierPaymentItem>,
    @InjectRepository(SupplierPayment)
    private readonly paymentRepo: Repository<SupplierPayment>,
  ) {}

  private toResponseDto(
    item: SupplierPaymentItem,
  ): SupplierPaymentItemResponseDto {
    return {
      id: item.id,
      payment_id: item.payment_id,
      document_number: item.document_number,
      document_type: item.document_type,
      amount: Number(item.amount),
    };
  }

  private async assertPaymentExists(
    paymentId: number,
    scopedCompanyId?: number,
  ): Promise<SupplierPayment> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, deleted_at: IsNull() },
    });
    if (!payment) {
      throw new NotFoundException(
        `Supplier payment with ID ${paymentId} not found`,
      );
    }
    // Multi-tenant guard: merchant users can only touch items of their own company's payments.
    if (scopedCompanyId != null && payment.company_id !== scopedCompanyId) {
      throw new NotFoundException(
        `Supplier payment with ID ${paymentId} not found`,
      );
    }
    return payment;
  }

  /**
   * Posted Payment Immobility Lock: once a payment is posted, fully allocated, voided,
   * or has any allocated amount, its breakdown items are frozen.
   */
  private assertPaymentMutable(payment: SupplierPayment): void {
    const frozenStatuses: SupplierPaymentStatus[] = [
      SupplierPaymentStatus.POSTED,
      SupplierPaymentStatus.FULLY_ALLOCATED,
      SupplierPaymentStatus.CANCELLED,
    ];
    if (
      frozenStatuses.includes(payment.status) ||
      Number(payment.allocated_amount) > 0
    ) {
      throw new BadRequestException(
        'Payment items cannot be modified: the parent payment voucher is posted, allocated, or voided.',
      );
    }
  }

  /** Sum of the payment's live items, optionally excluding the item being updated. */
  private async sumActiveItems(
    paymentId: number,
    excludeItemId?: number,
  ): Promise<number> {
    const qb = this.itemRepo
      .createQueryBuilder('spi')
      .select('COALESCE(SUM(spi.amount), 0)', 'sum')
      .where('spi.payment_id = :paymentId', { paymentId })
      .andWhere('spi.deleted_at IS NULL');
    if (excludeItemId != null) {
      qb.andWhere('spi.id <> :excludeItemId', { excludeItemId });
    }
    const raw = await qb.getRawOne<{ sum: string }>();
    return Number(raw?.sum ?? 0);
  }

  /**
   * Parent Amount Enforcement: the sum of a payment's items can never exceed the
   * parent voucher total. Uses a cent-level tolerance to survive decimal rounding.
   */
  private async assertWithinPaymentTotal(
    payment: SupplierPayment,
    incomingAmount: number,
    excludeItemId?: number,
  ): Promise<void> {
    const others = await this.sumActiveItems(payment.id, excludeItemId);
    const projected = others + incomingAmount;
    const total = Number(payment.total_amount);
    if (projected > total + 0.001) {
      throw new BadRequestException(
        `The total amount of payment items ($${projected.toFixed(2)}) cannot exceed the parent payment voucher total ($${total.toFixed(2)}).`,
      );
    }
  }

  async create(
    dto: CreateSupplierPaymentItemDto,
    scopedCompanyId?: number,
  ): Promise<OneSupplierPaymentItemResponseDto> {
    const payment = await this.assertPaymentExists(
      dto.payment_id,
      scopedCompanyId,
    );
    this.assertPaymentMutable(payment);
    await this.assertWithinPaymentTotal(payment, Number(dto.amount));

    const row = this.itemRepo.create({
      payment_id: dto.payment_id,
      document_number: dto.document_number,
      document_type: dto.document_type,
      amount: dto.amount,
    });
    const saved = await this.itemRepo.save(row);
    return {
      statusCode: 201,
      message: 'Supplier payment item created successfully',
      data: this.toResponseDto(saved),
    };
  }

  async findAll(
    query: GetSupplierPaymentItemsQueryDto,
    scopedCompanyId?: number,
  ): Promise<PaginatedSupplierPaymentItemsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? SupplierPaymentItemSortBy.ID;
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb = this.itemRepo
      .createQueryBuilder('spi')
      .where('spi.deleted_at IS NULL');

    // Multi-tenant guard: merchant users only see items of their own company's payments.
    if (scopedCompanyId != null) {
      qb.innerJoin(
        SupplierPayment,
        'sp',
        'sp.id = spi.payment_id AND sp.company_id = :companyId',
        { companyId: scopedCompanyId },
      );
    }

    if (query.payment_id != null) {
      qb.andWhere('spi.payment_id = :paymentId', {
        paymentId: query.payment_id,
      });
    }
    if (query.document_type != null) {
      qb.andWhere('spi.document_type = :docType', {
        docType: query.document_type,
      });
    }

    const orderColumn =
      sortBy === SupplierPaymentItemSortBy.AMOUNT
        ? 'spi.amount'
        : sortBy === SupplierPaymentItemSortBy.DOCUMENT_NUMBER
          ? 'spi.document_number'
          : sortBy === SupplierPaymentItemSortBy.DOCUMENT_TYPE
            ? 'spi.document_type'
            : 'spi.id';

    qb.orderBy(orderColumn, sortOrder);

    const total = await qb.getCount();
    const items = await qb.skip(skip).take(limit).getMany();
    const totalPages = Math.ceil(total / limit);

    return {
      statusCode: 200,
      message: 'Supplier payment items retrieved successfully',
      data: items.map((i) => this.toResponseDto(i)),
      paginationMeta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: number): Promise<OneSupplierPaymentItemResponseDto> {
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid supplier payment item ID');
    }

    const item = await this.itemRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!item) {
      throw new NotFoundException(
        `Supplier payment item with ID ${id} not found`,
      );
    }

    return {
      statusCode: 200,
      message: 'Supplier payment item retrieved successfully',
      data: this.toResponseDto(item),
    };
  }

  async update(
    id: number,
    dto: UpdateSupplierPaymentItemDto,
    scopedCompanyId?: number,
  ): Promise<OneSupplierPaymentItemResponseDto> {
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid supplier payment item ID');
    }

    const item = await this.itemRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!item) {
      throw new NotFoundException(
        `Supplier payment item with ID ${id} not found`,
      );
    }
    // Scope guard: the item's payment must belong to the user's company.
    const currentPayment = await this.assertPaymentExists(
      item.payment_id,
      scopedCompanyId,
    );
    this.assertPaymentMutable(currentPayment);

    let targetPayment = currentPayment;
    if (dto.payment_id != null && dto.payment_id !== item.payment_id) {
      targetPayment = await this.assertPaymentExists(
        dto.payment_id,
        scopedCompanyId,
      );
      this.assertPaymentMutable(targetPayment);
      item.payment_id = dto.payment_id;
    }
    if (dto.document_number != null) {
      item.document_number = dto.document_number;
    }
    if (dto.document_type != null) {
      item.document_type = dto.document_type;
    }
    if (dto.amount != null) {
      item.amount = dto.amount as any;
    }

    // Re-check the parent sum with the item's new amount, excluding its own current row.
    await this.assertWithinPaymentTotal(
      targetPayment,
      Number(item.amount),
      item.id,
    );

    const saved = await this.itemRepo.save(item);
    return {
      statusCode: 200,
      message: 'Supplier payment item updated successfully',
      data: this.toResponseDto(saved),
    };
  }

  async remove(
    id: number,
    scopedCompanyId?: number,
  ): Promise<OneSupplierPaymentItemResponseDto> {
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid supplier payment item ID');
    }

    const item = await this.itemRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!item) {
      throw new NotFoundException(
        `Supplier payment item with ID ${id} not found`,
      );
    }
    // Scope guard: the item's payment must belong to the user's company.
    const payment = await this.assertPaymentExists(
      item.payment_id,
      scopedCompanyId,
    );
    this.assertPaymentMutable(payment);

    item.deleted_at = new Date();
    await this.itemRepo.save(item);

    return {
      statusCode: 200,
      message: 'Supplier payment item deleted successfully',
      data: this.toResponseDto(item),
    };
  }
}
