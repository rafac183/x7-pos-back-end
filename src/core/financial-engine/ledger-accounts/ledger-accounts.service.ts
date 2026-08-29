import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerAccount } from './entities/ledger-account.entity';
import { AccountType } from './constants/account-type.enum';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { CreateLedgerAccountDto } from './dto/create-ledger-account.dto';
import { UpdateLedgerAccountDto } from './dto/update-ledger-account.dto';
import { GetLedgerAccountsQueryDto } from './dto/get-ledger-accounts-query.dto';
import { AllPaginatedLedgerAccounts } from './dto/all-paginated-ledger-accounts.dto';
import {
  LedgerAccountResponseDto,
  OneLedgerAccountResponse,
} from './dto/ledger-account-response.dto';
import { ErrorHandler } from 'src/common/utils/error-handler.util';
import { ErrorMessage } from 'src/common/constants/error-messages';

@Injectable()
export class LedgerAccountsService implements OnModuleInit {
  constructor(
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
      const count = await this.ledgerAccountRepository.count();
      if (count === 0) {
        const seedAccounts = [
          { company_id: 1, code: '1000', name: 'Assets', type: AccountType.ASSET, is_active: true, parent_account_id: undefined },
          { company_id: 1, code: '1100', name: 'Raw Material Inventory', type: AccountType.ASSET, is_active: true, parent_account_id: 1 },
          { company_id: 1, code: '1200', name: 'Finished Goods Inventory', type: AccountType.ASSET, is_active: true, parent_account_id: 1 },
          { company_id: 1, code: '1300', name: 'Cash & Bank Accounts', type: AccountType.ASSET, is_active: true, parent_account_id: 1 },
          { company_id: 1, code: '2000', name: 'Liabilities', type: AccountType.LIABILITY, is_active: true, parent_account_id: undefined },
          { company_id: 1, code: '2100', name: 'Accounts Payable', type: AccountType.LIABILITY, is_active: true, parent_account_id: 5 },
          { company_id: 1, code: '2200', name: 'Tax Payable', type: AccountType.LIABILITY, is_active: true, parent_account_id: 5 },
          { company_id: 1, code: '3000', name: 'Equity', type: AccountType.EQUITY, is_active: true, parent_account_id: undefined },
          { company_id: 1, code: '3100', name: 'Owner Capital', type: AccountType.EQUITY, is_active: true, parent_account_id: 8 },
          { company_id: 1, code: '4000', name: 'Revenue', type: AccountType.REVENUE, is_active: true, parent_account_id: undefined },
          { company_id: 1, code: '4100', name: 'POS Food & Beverage Sales', type: AccountType.REVENUE, is_active: true, parent_account_id: 10 },
          { company_id: 1, code: '5000', name: 'Expenses', type: AccountType.EXPENSE, is_active: true, parent_account_id: undefined },
          { company_id: 1, code: '5100', name: 'Cost of Goods Sold', type: AccountType.EXPENSE, is_active: true, parent_account_id: 12 },
          { company_id: 1, code: '5200', name: 'Waste & Shrinkage Expense', type: AccountType.EXPENSE, is_active: true, parent_account_id: 12 },
          { company_id: 1, code: '5300', name: 'Inventory Adjustment Variance', type: AccountType.EXPENSE, is_active: true, parent_account_id: 12 },
        ];
        await this.ledgerAccountRepository.save(seedAccounts as any);
      }
    } catch (err: any) {
      console.log('LedgerAccounts DB seed check deferred:', err.message);
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

  private buildResponse(
    account: LedgerAccount,
    createdUpdateDelete?: string,
  ): OneLedgerAccountResponse {
    const data = this.toResponseDto(account);
    switch (createdUpdateDelete) {
      case 'Created':
        return {
          statusCode: 201,
          message: 'Ledger Account Created successfully',
          data,
        };
      case 'Updated':
        return {
          statusCode: 201,
          message: 'Ledger Account Updated successfully',
          data,
        };
      case 'Deleted':
        return {
          statusCode: 201,
          message: 'Ledger Account Deleted successfully',
          data,
        };
      default:
        return {
          statusCode: 200,
          message: 'Ledger Account retrieved successfully',
          data,
        };
    }
  }

  private toResponseDto(account: LedgerAccount): LedgerAccountResponseDto {
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      is_active: account.is_active,
      parent_account_id: account.parent_account_id ?? null,
      created_at: account.created_at,
      updated_at: account.updated_at,
      company: account.company
        ? { id: account.company.id, name: account.company.name }
        : null,
    };
  }

  /** Búsqueda interna por company_id directo (sin need to resolve from merchantId) */
  private async fetchOne(
    id: number,
    company_id: number,
    createdUpdateDelete?: string,
  ): Promise<OneLedgerAccountResponse> {
    const account = await this.ledgerAccountRepository.findOne({
      where: {
        id,
        company_id,
        is_active:
          createdUpdateDelete === 'Deleted'
            ? false
            : createdUpdateDelete === 'Updated'
              ? undefined
              : true,
      },
      relations: ['company'],
    });
    if (!account) ErrorHandler.notFound('Ledger Account not found');
    return this.buildResponse(account, createdUpdateDelete);
  }

  // ─── CRUD público ──────────────────────────────────────────────────────────

  async create(
    merchantId: number,
    dto: CreateLedgerAccountDto,
  ): Promise<OneLedgerAccountResponse> {
    const { code, name, type, parent_account_id } = dto;
    const company_id = await this.getCompanyId(merchantId);

    const company = await this.companyRepository.findOneBy({ id: company_id });
    if (!company) ErrorHandler.notFound(ErrorMessage.COMPANY_NOT_FOUND);

    const existing = await this.ledgerAccountRepository.findOne({
      where: { code, company_id, is_active: true },
    });
    if (existing)
      ErrorHandler.exists(`Ledger account with code '${code}' already exists`);

    if (parent_account_id) {
      const parent = await this.ledgerAccountRepository.findOneBy({
        id: parent_account_id,
        company_id,
        is_active: true,
      });
      if (!parent) ErrorHandler.notFound('Parent ledger account not found');
    }

    try {
      const newAccount = this.ledgerAccountRepository.create({
        code,
        name,
        type,
        company_id,
        parent_account_id: parent_account_id ?? undefined,
      });
      const saved = await this.ledgerAccountRepository.save(newAccount);
      return this.fetchOne(saved.id, company_id, 'Created');
    } catch (error) {
      ErrorHandler.handleDatabaseError(error);
    }
  }

  async findAll(
    query: GetLedgerAccountsQueryDto,
    merchantId: number,
  ): Promise<AllPaginatedLedgerAccounts> {
    const company_id = await this.getCompanyId(merchantId);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.ledgerAccountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.company', 'company')
      .where('account.company_id = :company_id', { company_id });

    if (query.name) {
      qb.andWhere('LOWER(account.name) LIKE LOWER(:name)', {
        name: `%${query.name}%`,
      });
    }

    if (query.type) {
      qb.andWhere('account.type = :type', { type: query.type });
    }

    const total = await qb.getCount();
    const accounts = await qb
      .orderBy('account.code', 'ASC')
      .skip(skip)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(total / limit);

    return {
      statusCode: 200,
      message: 'Ledger accounts retrieved successfully',
      data: accounts.map((a) => this.toResponseDto(a)),
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
  ): Promise<OneLedgerAccountResponse> {
    if (!id || id <= 0)
      ErrorHandler.invalidId('Ledger Account ID is incorrect');
    const company_id = await this.getCompanyId(merchantId);
    return this.fetchOne(id, company_id);
  }

  async update(
    id: number,
    merchantId: number,
    dto: UpdateLedgerAccountDto,
  ): Promise<OneLedgerAccountResponse> {
    if (!id || id <= 0)
      ErrorHandler.invalidId('Ledger Account ID is incorrect');

    const company_id = await this.getCompanyId(merchantId);

    const account = await this.ledgerAccountRepository.findOneBy({
      id,
      company_id,
    });
    if (!account) ErrorHandler.notFound('Ledger Account not found');

    if (dto.code && dto.code !== account.code) {
      const existing = await this.ledgerAccountRepository.findOne({
        where: { code: dto.code, company_id, is_active: true },
      });
      if (existing && existing.id !== id)
        ErrorHandler.exists(
          `Ledger account with code '${dto.code}' already exists`,
        );
    }

    if (dto.parent_account_id) {
      if (dto.parent_account_id === id) {
        ErrorHandler.badRequest('A ledger account cannot be its own parent');
      }

      const parent = await this.ledgerAccountRepository.findOneBy({
        id: dto.parent_account_id,
        company_id,
        is_active: true,
      });
      if (!parent) ErrorHandler.notFound('Parent ledger account not found');
    }

    Object.assign(account, dto);

    try {
      await this.ledgerAccountRepository.save(account);
      return this.fetchOne(id, company_id, 'Updated');
    } catch (error) {
      ErrorHandler.handleDatabaseError(error);
    }
  }

  async remove(
    id: number,
    merchantId: number,
  ): Promise<OneLedgerAccountResponse> {
    if (!id || id <= 0)
      ErrorHandler.invalidId('Ledger Account ID is incorrect');

    const company_id = await this.getCompanyId(merchantId);

    const account = await this.ledgerAccountRepository.findOneBy({
      id,
      company_id,
      is_active: true,
    });
    if (!account) ErrorHandler.notFound('Ledger Account not found');

    try {
      account.is_active = false;
      await this.ledgerAccountRepository.save(account);
      return this.fetchOne(id, company_id, 'Deleted');
    } catch (error) {
      ErrorHandler.handleDatabaseError(error);
    }
  }
}
