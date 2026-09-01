import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreateSupplierPaymentAllocationDto } from './dto/create-supplier_payment_allocation.dto';
import { UpdateSupplierPaymentAllocationDto } from './dto/update-supplier_payment_allocation.dto';
import { SupplierPaymentAllocation } from './entities/supplier_payment_allocation.entity';
import { SupplierPayment } from '../supplier-payments/entities/supplier-payment.entity';
import { SupplierPaymentStatus } from '../supplier-payments/constants/supplier-payment-status.enum';
import { Supplier } from 'src/core/business-partners/suppliers/entities/supplier.entity';
import {
  SupplierCreditNote,
  SupplierCreditNoteStatus,
} from '../supplier-credit-notes/entities/supplier-credit-note.entity';
import { SupplierInvoice } from '../supplier-invoices/entities/supplier-invoice.entity';
import { SupplierInvoiceStatus } from '../supplier-invoices/constants/supplier-invoice-status.enum';
import {
  GetSupplierPaymentAllocationsQueryDto,
  SupplierPaymentAllocationSortBy,
} from './dto/get-supplier_payment_allocations-query.dto';
import {
  OneSupplierPaymentAllocationResponseDto,
  SupplierPaymentAllocationResponseDto,
} from './dto/supplier_payment_allocation-response.dto';
import { PaginatedSupplierPaymentAllocationsResponseDto } from './dto/paginated-supplier_payment_allocations-response.dto';

@Injectable()
export class SupplierPaymentAllocationsService {
  constructor(
    @InjectRepository(SupplierPaymentAllocation)
    private readonly allocationRepo: Repository<SupplierPaymentAllocation>,
    @InjectRepository(SupplierPayment)
    private readonly paymentRepo: Repository<SupplierPayment>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(SupplierCreditNote)
    private readonly creditNoteRepo: Repository<SupplierCreditNote>,
    @InjectRepository(SupplierInvoice)
    private readonly invoiceRepo: Repository<SupplierInvoice>,
  ) {}

  /**
   * Recompute a payment's allocated_amount (sum of its live allocations) and derive its
   * allocation status. Never overrides a CANCELLED payment. Returns the saved payment
   * (needed for company-scoped invoice recompute) or null if the payment is gone.
   */
  private async recomputePayment(
    paymentId: number,
  ): Promise<SupplierPayment | null> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId, deleted_at: IsNull() },
    });
    if (!payment) return null;

    const raw = await this.allocationRepo
      .createQueryBuilder('spa')
      .select('COALESCE(SUM(spa.allocated_amount), 0)', 'sum')
      .where('spa.payment_id = :paymentId', { paymentId })
      .andWhere('spa.deleted_at IS NULL')
      .getRawOne<{ sum: string }>();

    const allocated = Number(raw?.sum ?? 0);
    const total = Number(payment.total_amount);
    payment.allocated_amount = allocated;

    if (payment.status !== SupplierPaymentStatus.CANCELLED) {
      if (total > 0 && allocated >= total) {
        payment.status = SupplierPaymentStatus.FULLY_ALLOCATED;
      } else if (allocated > 0) {
        payment.status = SupplierPaymentStatus.PARTIALLY_ALLOCATED;
      } else if (
        payment.status === SupplierPaymentStatus.PARTIALLY_ALLOCATED ||
        payment.status === SupplierPaymentStatus.FULLY_ALLOCATED
      ) {
        // Allocations fully removed → fall back to DRAFT (leave DRAFT/POSTED untouched).
        payment.status = SupplierPaymentStatus.DRAFT;
      }
    }
    return this.paymentRepo.save(payment);
  }

  /**
   * Recompute paid_amount/balance_due/status for every non-deleted invoice matching
   * (company, supplier, invoice_number) referenced by an allocation, summing all live
   * invoice-type allocations that point at that document across the company's payments.
   */
  private async recomputeInvoicesForDocument(
    companyId: number,
    supplierId: number,
    documentNumber: string,
  ): Promise<void> {
    const invoices = await this.invoiceRepo.find({
      where: {
        company_id: companyId,
        supplier_id: supplierId,
        invoice_number: documentNumber,
        deleted_at: IsNull(),
      },
    });
    if (invoices.length === 0) return;

    // Sum every live invoice allocation pointing at this document, funded by either a
    // payment or a credit note of this company (LEFT joins — the funding source is a XOR).
    const raw = await this.allocationRepo
      .createQueryBuilder('spa')
      .leftJoin(
        SupplierPayment,
        'sp',
        'sp.id = spa.payment_id AND sp.deleted_at IS NULL',
      )
      .leftJoin(
        SupplierCreditNote,
        'scn',
        'scn.id = spa.credit_note_id AND scn.deleted_at IS NULL',
      )
      .select('COALESCE(SUM(spa.allocated_amount), 0)', 'sum')
      .where('spa.deleted_at IS NULL')
      .andWhere('(sp.company_id = :companyId OR scn.company_id = :companyId)', {
        companyId,
      })
      .andWhere('spa.supplier_id = :supplierId', { supplierId })
      .andWhere('spa.document_number = :documentNumber', { documentNumber })
      .andWhere('LOWER(spa.document_type) = :docType', { docType: 'invoice' })
      .getRawOne<{ sum: string }>();

    const paid = Number(raw?.sum ?? 0);
    for (const inv of invoices) {
      const total = Number(inv.total_amount);
      inv.paid_amount = paid;
      inv.balance_due = Math.max(0, total - paid);
      if (inv.status !== SupplierInvoiceStatus.CANCELLED) {
        if (paid <= 0) inv.status = SupplierInvoiceStatus.PENDING;
        else if (paid >= total) inv.status = SupplierInvoiceStatus.PAID;
        else inv.status = SupplierInvoiceStatus.PARTIALLY_PAID;
      }
      await this.invoiceRepo.save(inv);
    }
  }

  /**
   * Recompute applied_amount/status for a credit note from its live allocations
   * (sum of allocations that reference it). Never overrides a CANCELLED credit note.
   */
  private async recomputeCreditNote(creditNoteId: number): Promise<void> {
    const cn = await this.creditNoteRepo.findOne({
      where: { id: creditNoteId, deleted_at: IsNull() },
    });
    if (!cn) return;

    const raw = await this.allocationRepo
      .createQueryBuilder('spa')
      .select('COALESCE(SUM(spa.allocated_amount), 0)', 'sum')
      .where('spa.credit_note_id = :creditNoteId', { creditNoteId })
      .andWhere('spa.deleted_at IS NULL')
      .getRawOne<{ sum: string }>();

    const applied = Number(raw?.sum ?? 0);
    const total = Number(cn.total_amount);
    cn.applied_amount = applied;

    if (cn.status !== SupplierCreditNoteStatus.CANCELLED) {
      if (total > 0 && applied >= total) {
        cn.status = SupplierCreditNoteStatus.FULLY_APPLIED;
      } else if (applied > 0) {
        cn.status = SupplierCreditNoteStatus.PARTIALLY_APPLIED;
      } else if (
        cn.status === SupplierCreditNoteStatus.PARTIALLY_APPLIED ||
        cn.status === SupplierCreditNoteStatus.FULLY_APPLIED
      ) {
        // Applications fully removed → revert to ISSUED (it had to be issued to be applied).
        cn.status = SupplierCreditNoteStatus.ISSUED;
      }
    }
    await this.creditNoteRepo.save(cn);
  }

  /**
   * Recompute every aggregate an allocation touches: the payment, the target invoice(s)
   * (for invoice allocations), and the credit note (when the allocation references one).
   * The funding source is a XOR, so the company for the invoice recompute comes from
   * whichever side is set — payment for cash allocations, credit note for credit ones.
   */
  private async cascadeAggregates(ref: {
    payment_id: number | null;
    supplier_id: number;
    document_number: string;
    document_type: string;
    credit_note_id?: number | null;
  }): Promise<void> {
    let companyId: number | null = null;

    if (ref.payment_id != null) {
      const payment = await this.recomputePayment(ref.payment_id);
      companyId = payment?.company_id ?? null;
    }
    if (ref.credit_note_id != null) {
      await this.recomputeCreditNote(ref.credit_note_id);
      if (companyId == null) {
        const cn = await this.creditNoteRepo.findOne({
          where: { id: ref.credit_note_id, deleted_at: IsNull() },
        });
        companyId = cn?.company_id ?? null;
      }
    }

    if (companyId != null && String(ref.document_type).toLowerCase() === 'invoice') {
      await this.recomputeInvoicesForDocument(
        companyId,
        ref.supplier_id,
        ref.document_number,
      );
    }
  }

  private toResponseDto(
    row: SupplierPaymentAllocation,
  ): SupplierPaymentAllocationResponseDto {
    return {
      id: row.id,
      payment_id: row.payment_id,
      credit_note_id: row.credit_note_id ?? null,
      supplier_id: row.supplier_id,
      document_number: row.document_number,
      document_type: row.document_type,
      allocated_amount: Number(row.allocated_amount),
      created_at: row.created_at?.toISOString() ?? '',
    };
  }

  private async validateRelations(
    dto: Partial<CreateSupplierPaymentAllocationDto>,
    current?: SupplierPaymentAllocation,
    scopedCompanyId?: number,
  ): Promise<void> {
    // Resolve the funding source as it will be AFTER this write, so the XOR guard also
    // covers partial updates (e.g. clearing payment_id while setting credit_note_id).
    const paymentId =
      dto.payment_id !== undefined ? dto.payment_id : current?.payment_id;
    const creditNoteIdResolved =
      dto.credit_note_id !== undefined
        ? dto.credit_note_id
        : current?.credit_note_id;

    // Mutual exclusion: exactly one funding source — never both, never neither.
    // Only enforced on creates and on writes that actually touch a source field, so
    // legacy rows (written when payment_id was mandatory alongside credit_note_id)
    // stay editable and removable.
    const touchesSource =
      dto.payment_id !== undefined || dto.credit_note_id !== undefined;
    if (
      (current === undefined || touchesSource) &&
      (paymentId == null) === (creditNoteIdResolved == null)
    ) {
      throw new BadRequestException(
        'An allocation must be funded by exactly one source: either a payment or a credit note.',
      );
    }

    if (paymentId != null) {
      const payment = await this.paymentRepo.findOne({
        where: { id: paymentId, deleted_at: IsNull() },
      });
      if (!payment) {
        throw new NotFoundException(
          `Supplier payment with ID ${paymentId} not found`,
        );
      }
      // Multi-tenant guard: merchant users can only allocate their own company's payments.
      if (scopedCompanyId != null && payment.company_id !== scopedCompanyId) {
        throw new NotFoundException(
          `Supplier payment with ID ${paymentId} not found`,
        );
      }
    }

    const supplierId = dto.supplier_id ?? current?.supplier_id;
    if (supplierId != null) {
      const supplier = await this.supplierRepo.findOne({
        where: { id: supplierId },
      });
      if (!supplier) {
        throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
      }
    }

    if (creditNoteIdResolved != null) {
      const creditNote = await this.creditNoteRepo.findOne({
        where: { id: creditNoteIdResolved, deleted_at: IsNull() },
      });
      if (!creditNote) {
        throw new NotFoundException(
          `Supplier credit note with ID ${creditNoteIdResolved} not found`,
        );
      }
      // Multi-tenant guard: credit-note-funded allocations have no payment to scope
      // against, so the credit note itself carries the company check.
      if (
        scopedCompanyId != null &&
        creditNote.company_id !== scopedCompanyId
      ) {
        throw new NotFoundException(
          `Supplier credit note with ID ${creditNoteIdResolved} not found`,
        );
      }
    }
  }

  async create(
    dto: CreateSupplierPaymentAllocationDto,
    scopedCompanyId?: number,
  ): Promise<OneSupplierPaymentAllocationResponseDto> {
    await this.validateRelations(dto, undefined, scopedCompanyId);

    const row = this.allocationRepo.create({
      payment_id: dto.payment_id ?? null,
      credit_note_id: dto.credit_note_id ?? null,
      supplier_id: dto.supplier_id,
      document_number: dto.document_number,
      document_type: dto.document_type,
      allocated_amount: dto.allocated_amount,
    });

    const saved = await this.allocationRepo.save(row);
    await this.cascadeAggregates(saved);
    return {
      statusCode: 201,
      message: 'Supplier payment allocation created successfully',
      data: this.toResponseDto(saved),
    };
  }

  async findAll(
    query: GetSupplierPaymentAllocationsQueryDto,
    scopedCompanyId?: number,
  ): Promise<PaginatedSupplierPaymentAllocationsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? SupplierPaymentAllocationSortBy.CREATED_AT;
    const sortOrder = query.sortOrder ?? 'DESC';

    const qb = this.allocationRepo
      .createQueryBuilder('spa')
      .where('spa.deleted_at IS NULL');

    // Multi-tenant guard: merchant users only see allocations funded by their own
    // company. LEFT joins on both sides — a credit-note-funded allocation has no
    // payment_id, and an inner join on the payment would hide it entirely.
    if (scopedCompanyId != null) {
      qb.leftJoin(
        SupplierPayment,
        'sp',
        'sp.id = spa.payment_id AND sp.deleted_at IS NULL',
      )
        .leftJoin(
          SupplierCreditNote,
          'scn',
          'scn.id = spa.credit_note_id AND scn.deleted_at IS NULL',
        )
        .andWhere('(sp.company_id = :companyId OR scn.company_id = :companyId)', {
          companyId: scopedCompanyId,
        });
    }

    if (query.payment_id != null) {
      qb.andWhere('spa.payment_id = :paymentId', {
        paymentId: query.payment_id,
      });
    }
    if (query.supplier_id != null) {
      qb.andWhere('spa.supplier_id = :supplierId', {
        supplierId: query.supplier_id,
      });
    }
    if (query.credit_note_id != null) {
      qb.andWhere('spa.credit_note_id = :creditNoteId', {
        creditNoteId: query.credit_note_id,
      });
    }

    const orderColumn =
      sortBy === SupplierPaymentAllocationSortBy.ALLOCATED_AMOUNT
        ? 'spa.allocated_amount'
        : sortBy === SupplierPaymentAllocationSortBy.DOCUMENT_NUMBER
          ? 'spa.document_number'
          : sortBy === SupplierPaymentAllocationSortBy.ID
            ? 'spa.id'
            : 'spa.created_at';
    qb.orderBy(orderColumn, sortOrder);

    const total = await qb.getCount();
    const items = await qb.skip(skip).take(limit).getMany();
    const totalPages = Math.ceil(total / limit);

    return {
      statusCode: 200,
      message: 'Supplier payment allocations retrieved successfully',
      data: items.map((item) => this.toResponseDto(item)),
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

  async findOne(id: number): Promise<OneSupplierPaymentAllocationResponseDto> {
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid supplier payment allocation ID');
    }

    const row = await this.allocationRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!row) {
      throw new NotFoundException(
        `Supplier payment allocation with ID ${id} not found`,
      );
    }

    return {
      statusCode: 200,
      message: 'Supplier payment allocation retrieved successfully',
      data: this.toResponseDto(row),
    };
  }

  async update(
    id: number,
    dto: UpdateSupplierPaymentAllocationDto,
    scopedCompanyId?: number,
  ): Promise<OneSupplierPaymentAllocationResponseDto> {
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid supplier payment allocation ID');
    }

    const row = await this.allocationRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!row) {
      throw new NotFoundException(
        `Supplier payment allocation with ID ${id} not found`,
      );
    }

    // Scope guard on the existing row's payment, plus validate the (possibly new) relations.
    await this.validateRelations({}, row, scopedCompanyId);
    await this.validateRelations(dto, row, scopedCompanyId);

    // Capture the pre-change reference so aggregates for the previous target are recomputed too.
    const before = {
      payment_id: row.payment_id,
      supplier_id: row.supplier_id,
      document_number: row.document_number,
      document_type: row.document_type,
      credit_note_id: row.credit_note_id,
    };

    // Both sources accept an explicit null so the funding source can be switched.
    if (dto.payment_id !== undefined) row.payment_id = dto.payment_id ?? null;
    if (dto.credit_note_id !== undefined)
      row.credit_note_id = dto.credit_note_id ?? null;
    if (dto.supplier_id != null) row.supplier_id = dto.supplier_id;
    if (dto.document_number != null) row.document_number = dto.document_number;
    if (dto.document_type != null) row.document_type = dto.document_type;
    if (dto.allocated_amount != null)
      row.allocated_amount = dto.allocated_amount as any;

    const saved = await this.allocationRepo.save(row);
    await this.cascadeAggregates(before);
    await this.cascadeAggregates(saved);
    return {
      statusCode: 200,
      message: 'Supplier payment allocation updated successfully',
      data: this.toResponseDto(saved),
    };
  }

  async remove(
    id: number,
    scopedCompanyId?: number,
  ): Promise<OneSupplierPaymentAllocationResponseDto> {
    if (!id || id <= 0) {
      throw new BadRequestException('Invalid supplier payment allocation ID');
    }

    const row = await this.allocationRepo.findOne({
      where: { id, deleted_at: IsNull() },
    });
    if (!row) {
      throw new NotFoundException(
        `Supplier payment allocation with ID ${id} not found`,
      );
    }
    // Scope guard: the allocation's payment must belong to the user's company.
    await this.validateRelations({}, row, scopedCompanyId);

    row.deleted_at = new Date();
    await this.allocationRepo.save(row);
    await this.cascadeAggregates(row);

    return {
      statusCode: 200,
      message: 'Supplier payment allocation deleted successfully',
      data: this.toResponseDto(row),
    };
  }
}
