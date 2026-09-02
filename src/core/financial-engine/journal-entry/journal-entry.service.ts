import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalEntryLine } from 'src/core/financial-engine/journal-entry-line/entities/journal-entry-line.entity';

import { LedgerAccount } from '../ledger-accounts/entities/ledger-account.entity';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { GetJournalEntriesQueryDto } from './dto/get-journal-entries-query.dto';
import { AllPaginatedJournalEntries } from './dto/all-paginated-journal-entries.dto';
import {
  JournalEntryResponseDto,
  JournalEntryLineResponseDto,
  OneJournalEntryResponse,
} from './dto/journal-entry-response.dto';
import { ErrorHandler } from 'src/common/utils/error-handler.util';
import { ErrorMessage } from 'src/common/constants/error-messages';
import { JournalEntryStatus } from './constants/journal-entry-status.enum';
import { JournalEntryReferenceType } from './constants/journal-entry-reference-type.enum';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';

@Injectable()
export class JournalEntryService implements OnModuleInit {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private readonly journalEntryLineRepository: Repository<JournalEntryLine>,
    @InjectRepository(LedgerAccount)
    private readonly ledgerAccountRepository: Repository<LedgerAccount>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {}

  async onModuleInit() {
    await this.seedDatabaseIfEmpty();
  }

  async seedDatabaseIfEmpty() {
    try {
      const count = await this.journalEntryRepository.count();
      if (count === 0) {
        const entry1 = this.journalEntryRepository.create({
          company_id: 1,
          entry_number: 'JE-2026-001',
          entry_date: new Date('2026-08-19'),
          description: 'Stock Receipt: 50 KG Flour 25kg bag via Purchase Order #PO-2026-089',
          status: JournalEntryStatus.POSTED,
          total_debit: 1250.0,
          total_credit: 1250.0,
          reference_type: JournalEntryReferenceType.INVENTORY,
          reference_id: 89,
        } as any);
        const savedEntry1 = (await this.journalEntryRepository.save(entry1 as any)) as unknown as JournalEntry;
        await this.journalEntryLineRepository.save([
          { journal_entry_id: savedEntry1.id, account_id: 2, debit: 1250.0, credit: 0.0, description: 'Stock receipt: 50.0 KG Flour 25kg bag via PO #PO-2026-089' },
          { journal_entry_id: savedEntry1.id, account_id: 6, debit: 0.0, credit: 1250.0, description: 'Supplier Accounts Payable liability for Purchase Order #PO-2026-089' },
        ]);

        const entry2 = this.journalEntryRepository.create({
          company_id: 1,
          entry_number: 'JE-2026-002',
          entry_date: new Date('2026-08-18'),
          description: 'POS Sales Depletion & Cost Allocation Order #1088',
          status: JournalEntryStatus.POSTED,
          total_debit: 345.5,
          total_credit: 345.5,
          reference_type: JournalEntryReferenceType.ORDER,
          reference_id: 1088,
        } as any);
        const savedEntry2 = (await this.journalEntryRepository.save(entry2 as any)) as unknown as JournalEntry;
        await this.journalEntryLineRepository.save([
          { journal_entry_id: savedEntry2.id, account_id: 13, debit: 345.5, credit: 0.0, description: 'Stock depletion: 15.5 KG Flour 25kg bag via POS Sales Order #1088' },
          { journal_entry_id: savedEntry2.id, account_id: 2, debit: 0.0, credit: 345.5, description: 'Raw material inventory reduction via POS Sales Order #1088' },
        ]);

        const entry3 = this.journalEntryRepository.create({
          company_id: 1,
          entry_number: 'JE-2026-003',
          entry_date: new Date('2026-08-17'),
          description: 'Stock Waste Write-off: Expired Whole Milk Batch #042',
          status: JournalEntryStatus.POSTED,
          total_debit: 88.0,
          total_credit: 88.0,
          reference_type: JournalEntryReferenceType.INVENTORY,
          reference_id: 42,
        } as any);
        const savedEntry3 = (await this.journalEntryRepository.save(entry3 as any)) as unknown as JournalEntry;
        await this.journalEntryLineRepository.save([
          { journal_entry_id: savedEntry3.id, account_id: 14, debit: 88.0, credit: 0.0, description: 'Inventory waste breakdown: 2.0 L Whole Milk (Expired batch)' },
          { journal_entry_id: savedEntry3.id, account_id: 2, debit: 0.0, credit: 88.0, description: 'Raw material inventory write-off for expired batch #042' },
        ]);

        const entry4 = this.journalEntryRepository.create({
          company_id: 1,
          entry_number: 'JE-2026-004',
          entry_date: new Date('2026-08-16'),
          description: 'Physical Inventory Audit Adjustment - Main Storage Hub',
          status: JournalEntryStatus.DRAFT,
          total_debit: 150.0,
          total_credit: 150.0,
          reference_type: JournalEntryReferenceType.ADJUSTMENT,
          reference_id: 15,
        } as any);
        const savedEntry4 = (await this.journalEntryRepository.save(entry4 as any)) as unknown as JournalEntry;
        await this.journalEntryLineRepository.save([
          { journal_entry_id: savedEntry4.id, account_id: 2, debit: 150.0, credit: 0.0, description: 'Physical count adjustment: System count 10 -> Actual count 15 (+5 units)' },
          { journal_entry_id: savedEntry4.id, account_id: 15, debit: 0.0, credit: 150.0, description: 'Physical count variance adjustment gain credit' },
        ]);

        const entry5 = this.journalEntryRepository.create({
          company_id: 1,
          entry_number: 'JE-2026-005',
          entry_date: new Date('2026-08-15'),
          description: 'Raw Material Supplier Stock Receipt: 30.0 L Extra Virgin Olive Oil via PO #PO-2026-095',
          status: JournalEntryStatus.POSTED,
          total_debit: 450.0,
          total_credit: 450.0,
          reference_type: JournalEntryReferenceType.INVENTORY,
          reference_id: 95,
        } as any);
        const savedEntry5 = (await this.journalEntryRepository.save(entry5 as any)) as unknown as JournalEntry;
        await this.journalEntryLineRepository.save([
          { journal_entry_id: savedEntry5.id, account_id: 2, debit: 450.0, credit: 0.0, description: 'Stock receipt: 30.0 L Extra Virgin Olive Oil via Purchase Order #PO-2026-095' },
          { journal_entry_id: savedEntry5.id, account_id: 6, debit: 0.0, credit: 450.0, description: 'Supplier Accounts Payable liability for Purchase Order #PO-2026-095' },
        ]);

        const entry6 = this.journalEntryRepository.create({
          company_id: 1,
          entry_number: 'JE-2026-006',
          entry_date: new Date('2026-08-14'),
          description: 'Supplier Duplicate Stock Receipt Reversal & Order Cancellation',
          status: JournalEntryStatus.VOIDED,
          total_debit: 620.0,
          total_credit: 620.0,
          reference_type: JournalEntryReferenceType.INVENTORY,
          reference_id: 99,
        } as any);
        const savedEntry6 = (await this.journalEntryRepository.save(entry6 as any)) as unknown as JournalEntry;
        await this.journalEntryLineRepository.save([
          { journal_entry_id: savedEntry6.id, account_id: 2, debit: 620.0, credit: 0.0, description: 'Duplicate raw material inventory posting reversal' },
          { journal_entry_id: savedEntry6.id, account_id: 6, debit: 0.0, credit: 620.0, description: 'Cancelled supplier accounts payable entry' },
        ]);

        const entry7 = this.journalEntryRepository.create({
          company_id: 1,
          entry_number: 'JE-2026-007',
          entry_date: new Date('2026-08-13'),
          description: 'Inventory Physical Count Reconciliation - Walk-in Freezer Hub',
          status: JournalEntryStatus.DRAFT,
          total_debit: 980.0,
          total_credit: 980.0,
          reference_type: JournalEntryReferenceType.ADJUSTMENT,
          reference_id: 22,
        } as any);
        const savedEntry7 = (await this.journalEntryRepository.save(entry7 as any)) as unknown as JournalEntry;
        await this.journalEntryLineRepository.save([
          { journal_entry_id: savedEntry7.id, account_id: 2, debit: 980.0, credit: 0.0, description: 'Freezer Hub physical count reconciliation: +25 units frozen beef patties' },
          { journal_entry_id: savedEntry7.id, account_id: 15, debit: 0.0, credit: 980.0, description: 'Inventory physical count gain adjustment credit' },
        ]);

        const entry8 = this.journalEntryRepository.create({
          company_id: 1,
          entry_number: 'JE-2026-008',
          entry_date: new Date('2026-08-12'),
          description: 'Voided Damaged Stock Return to Supplier Entry',
          status: JournalEntryStatus.VOIDED,
          total_debit: 210.0,
          total_credit: 210.0,
          reference_type: JournalEntryReferenceType.INVENTORY,
          reference_id: 104,
        } as any);
        const savedEntry8 = (await this.journalEntryRepository.save(entry8 as any)) as unknown as JournalEntry;
        await this.journalEntryLineRepository.save([
          { journal_entry_id: savedEntry8.id, account_id: 6, debit: 210.0, credit: 0.0, description: 'Voided damaged stock return debit' },
          { journal_entry_id: savedEntry8.id, account_id: 15, debit: 0.0, credit: 210.0, description: 'Voided damaged stock return variance credit' },
        ]);
      }
    } catch (err: any) {
      console.log('JournalEntry DB seed check deferred:', err.message);
    }
  }

  // ─── Helpers privados ──────────────────────────────────────────────────────

  private async getCompanyId(merchantId: number): Promise<number> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
      select: ['companyId'],
    });
    if (!merchant) ErrorHandler.notFound(ErrorMessage.MERCHANT_NOT_FOUND);
    return merchant.companyId;
  }

  private toLineResponseDto(
    line: JournalEntryLine,
  ): JournalEntryLineResponseDto {
    return {
      id: line.id,
      account: line.account
        ? {
            id: line.account.id,
            code: line.account.code,
            name: line.account.name,
          }
        : null,
      debit: Number(line.debit),
      credit: Number(line.credit),
      description: line.description ?? null,
    };
  }

  private toResponseDto(entry: JournalEntry): JournalEntryResponseDto {
    return {
      id: entry.id,
      entry_number: entry.entry_number,
      entry_date: entry.entry_date,
      description: entry.description ?? null,
      status: entry.status,
      total_debit: Number(entry.total_debit),
      total_credit: Number(entry.total_credit),
      is_balanced:
        Math.abs(Number(entry.total_debit) - Number(entry.total_credit)) <
        0.001,
      reference_type: entry.reference_type ?? null,
      reference_id: entry.reference_id ?? null,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      company: entry.company
        ? { id: entry.company.id, name: entry.company.name }
        : null,
      lines: entry.lines
        ? entry.lines.map((l) => this.toLineResponseDto(l))
        : [],
    };
  }

  private buildResponse(
    entry: JournalEntry,
    createdUpdateDelete?: string,
  ): OneJournalEntryResponse {
    const data = this.toResponseDto(entry);
    switch (createdUpdateDelete) {
      case 'Created':
        return {
          statusCode: 201,
          message: 'Journal Entry Created successfully',
          data,
        };
      case 'Updated':
        return {
          statusCode: 200,
          message: 'Journal Entry Updated successfully',
          data,
        };
      case 'Deleted':
        return {
          statusCode: 200,
          message: 'Journal Entry Deleted successfully',
          data,
        };
      case 'Voided':
        return {
          statusCode: 200,
          message: 'Journal Entry Voided successfully',
          data,
        };
      default:
        return {
          statusCode: 200,
          message: 'Journal Entry retrieved successfully',
          data,
        };
    }
  }

  private async fetchOne(
    id: number,
    company_id: number,
    action?: string,
  ): Promise<OneJournalEntryResponse> {
    const entry = await this.journalEntryRepository.findOne({
      where: { id, company_id, is_active: true },
      relations: ['company', 'lines', 'lines.account'],
    });
    if (!entry) ErrorHandler.notFound('Journal Entry not found');
    return this.buildResponse(entry, action);
  }

  // ─── CRUD público ──────────────────────────────────────────────────────────

  async create(
    merchantId: number,
    dto: CreateJournalEntryDto,
  ): Promise<OneJournalEntryResponse> {
    const company_id = await this.getCompanyId(merchantId);

    const company = await this.companyRepository.findOneBy({ id: company_id });
    if (!company) ErrorHandler.notFound(ErrorMessage.COMPANY_NOT_FOUND);

    // Validar entry_number único dentro de la empresa
    const existing = await this.journalEntryRepository.findOne({
      where: { entry_number: dto.entry_number, company_id, is_active: true },
    });
    if (existing)
      ErrorHandler.exists(
        `Journal entry with number '${dto.entry_number}' already exists`,
      );

    // Validar que las líneas estén balanceadas (debit === credit)
    if (!dto.lines || dto.lines.length === 0)
      ErrorHandler.badRequest('Journal entry must have at least one line');

    const totalDebit = dto.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = dto.lines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001)
      ErrorHandler.badRequest(
        `Journal entry is not balanced: total debit (${totalDebit}) ≠ total credit (${totalCredit})`,
      );

    // Validar que todas las cuentas contables existan y pertenezcan a la empresa
    for (const line of dto.lines) {
      const account = await this.ledgerAccountRepository.findOneBy({
        id: line.account_id,
        company_id,
        is_active: true,
      });
      if (!account)
        ErrorHandler.notFound(
          `Ledger account with ID ${line.account_id} not found or inactive`,
        );
    }

    try {
      const newEntry = this.journalEntryRepository.create({
        company_id,
        entry_number: dto.entry_number,
        entry_date: dto.entry_date as unknown as Date,
        description: dto.description,
        status: dto.status ?? JournalEntryStatus.DRAFT,
        total_debit: totalDebit,
        total_credit: totalCredit,
        reference_type: dto.reference_type,
        reference_id: dto.reference_id,
        lines: dto.lines.map((l) =>
          this.journalEntryLineRepository.create({
            account_id: l.account_id,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          }),
        ),
      });

      const saved = await this.journalEntryRepository.save(newEntry);
      return this.fetchOne(saved.id, company_id, 'Created');
    } catch (error) {
      ErrorHandler.handleDatabaseError(error);
    }
  }

  async findAll(
    query: GetJournalEntriesQueryDto,
    merchantId: number,
  ): Promise<AllPaginatedJournalEntries> {
    const company_id = await this.getCompanyId(merchantId);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.journalEntryRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.company', 'company')
      .leftJoinAndSelect('entry.lines', 'lines')
      .leftJoinAndSelect('lines.account', 'account')
      .where('entry.company_id = :company_id', { company_id })
      .andWhere('entry.is_active = :is_active', { is_active: true });

    if (query.status) {
      qb.andWhere('entry.status = :status', { status: query.status });
    }

    if (query.reference_type) {
      qb.andWhere('entry.reference_type = :reference_type', {
        reference_type: query.reference_type,
      });
    }

    const total = await qb.getCount();
    const entries = await qb
      .orderBy('entry.entry_date', 'DESC')
      .addOrderBy('entry.entry_number', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(total / limit);

    return {
      statusCode: 200,
      message: 'Journal entries retrieved successfully',
      data: entries.map((e) => this.toResponseDto(e)),
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  async findOne(
    id: number,
    merchantId: number,
  ): Promise<OneJournalEntryResponse> {
    if (!id || id <= 0) ErrorHandler.invalidId('Journal Entry ID is incorrect');
    const company_id = await this.getCompanyId(merchantId);
    return this.fetchOne(id, company_id);
  }

  async update(
    id: number,
    merchantId: number,
    dto: UpdateJournalEntryDto,
  ): Promise<OneJournalEntryResponse> {
    if (!id || id <= 0) ErrorHandler.invalidId('Journal Entry ID is incorrect');

    const company_id = await this.getCompanyId(merchantId);

    const entry = await this.journalEntryRepository.findOne({
      where: { id, company_id, is_active: true },
      relations: ['lines'],
    });
    if (!entry) ErrorHandler.notFound('Journal Entry not found');

    // Solo se pueden editar entradas en DRAFT
    if (entry.status !== JournalEntryStatus.DRAFT)
      ErrorHandler.badRequest('Only DRAFT journal entries can be updated');

    if (dto.entry_number && dto.entry_number !== entry.entry_number) {
      const existing = await this.journalEntryRepository.findOne({
        where: { entry_number: dto.entry_number, company_id, is_active: true },
      });
      if (existing && existing.id !== id)
        ErrorHandler.exists(
          `Journal entry with number '${dto.entry_number}' already exists`,
        );
    }

    // Si se actualizan las líneas, re-validar balance y cuentas
    let totalDebit = Number(entry.total_debit);
    let totalCredit = Number(entry.total_credit);

    if (dto.lines && dto.lines.length > 0) {
      totalDebit = dto.lines.reduce((sum, l) => sum + l.debit, 0);
      totalCredit = dto.lines.reduce((sum, l) => sum + l.credit, 0);

      if (Math.abs(totalDebit - totalCredit) > 0.001)
        ErrorHandler.badRequest(
          `Journal entry is not balanced: total debit (${totalDebit}) ≠ total credit (${totalCredit})`,
        );

      for (const line of dto.lines) {
        const account = await this.ledgerAccountRepository.findOneBy({
          id: line.account_id,
          company_id,
          is_active: true,
        });
        if (!account)
          ErrorHandler.notFound(
            `Ledger account with ID ${line.account_id} not found or inactive`,
          );
      }

      // Marcar líneas anteriores como inactivas (borrado lógico)
      await this.journalEntryLineRepository.update(
        { journal_entry_id: id },
        { is_active: false },
      );

      entry.lines = dto.lines.map((l) =>
        this.journalEntryLineRepository.create({
          journal_entry_id: id,
          account_id: l.account_id,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        }),
      );
    }

    Object.assign(entry, {
      entry_number: dto.entry_number ?? entry.entry_number,
      entry_date: dto.entry_date
        ? (dto.entry_date as unknown as Date)
        : entry.entry_date,
      description: dto.description ?? entry.description,
      status: dto.status ?? entry.status,
      total_debit: totalDebit,
      total_credit: totalCredit,
      reference_type: dto.reference_type ?? entry.reference_type,
      reference_id: dto.reference_id ?? entry.reference_id,
    });

    try {
      await this.journalEntryRepository.save(entry);
      return this.fetchOne(id, company_id, 'Updated');
    } catch (error) {
      ErrorHandler.handleDatabaseError(error);
    }
  }

  async remove(id: number, merchantId: number): Promise<SuccessResponse> {
    if (!id || id <= 0) ErrorHandler.invalidId('Journal Entry ID is incorrect');

    const company_id = await this.getCompanyId(merchantId);
    const entry = await this.journalEntryRepository.findOne({
      where: { id, company_id, is_active: true },
    });

    if (!entry) ErrorHandler.notFound('Journal Entry not found');

    if (entry.status !== JournalEntryStatus.DRAFT) {
      ErrorHandler.badRequest('Only DRAFT journal entries can be deleted');
    }

    try {
      entry.is_active = false;
      await this.journalEntryRepository.save(entry);

      return {
        statusCode: 200,
        message: 'Journal Entry deleted successfully',
      };
    } catch (error) {
      ErrorHandler.handleDatabaseError(error);
    }
  }

  async post(id: number, merchantId: number): Promise<OneJournalEntryResponse> {
    if (!id || id <= 0) ErrorHandler.invalidId('Journal Entry ID is incorrect');

    const company_id = await this.getCompanyId(merchantId);

    const entry = await this.journalEntryRepository.findOne({
      where: { id, company_id, is_active: true },
      relations: ['lines'],
    });

    if (!entry) ErrorHandler.notFound('Journal Entry not found');

    if (entry.status === JournalEntryStatus.POSTED) {
      ErrorHandler.badRequest('Journal entry is already posted');
    }

    if (!entry.lines || entry.lines.length === 0) {
      ErrorHandler.badRequest('Cannot post an entry without lines');
    }

    // Re-validar balanceo antes de postear (defensa en profundidad)
    const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = entry.lines.reduce(
      (sum, l) => sum + Number(l.credit),
      0,
    );

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      ErrorHandler.badRequest(
        `Cannot post unbalanced journal entry: total debit (${totalDebit}) ≠ total credit (${totalCredit})`,
      );
    }

    entry.status = JournalEntryStatus.POSTED;

    try {
      await this.journalEntryRepository.save(entry);
      return this.fetchOne(id, company_id, 'Updated');
    } catch (error) {
      ErrorHandler.handleDatabaseError(error);
    }
  }

  async void(id: number, merchantId: number): Promise<OneJournalEntryResponse> {
    if (!id || id <= 0) ErrorHandler.invalidId('Journal Entry ID is incorrect');

    const company_id = await this.getCompanyId(merchantId);
    const entry = await this.journalEntryRepository.findOne({
      where: { id, company_id, is_active: true },
    });

    if (!entry) ErrorHandler.notFound('Journal Entry not found');

    if (entry.status === JournalEntryStatus.VOIDED) {
      ErrorHandler.badRequest('Journal Entry is already voided');
    }

    entry.status = JournalEntryStatus.VOIDED;

    try {
      await this.journalEntryRepository.save(entry);
      return this.fetchOne(id, company_id, 'Voided');
    } catch (error) {
      ErrorHandler.handleDatabaseError(error);
    }
  }
}
