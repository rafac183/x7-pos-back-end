import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Scopes } from 'src/auth/decorators/scopes.decorator';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';

export interface LedgerAccountDto {
  id: number;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  is_active: boolean;
  parent_account_id: number | null;
}

let MOCK_LEDGER_ACCOUNTS: LedgerAccountDto[] = [
  { id: 1, code: '1000', name: 'Assets', type: 'ASSET', is_active: true, parent_account_id: null },
  { id: 2, code: '1100', name: 'Raw Material Inventory', type: 'ASSET', is_active: true, parent_account_id: 1 },
  { id: 3, code: '1200', name: 'Finished Goods Inventory', type: 'ASSET', is_active: true, parent_account_id: 1 },
  { id: 4, code: '1300', name: 'Cash & Bank Accounts', type: 'ASSET', is_active: true, parent_account_id: 1 },
  { id: 5, code: '2000', name: 'Liabilities', type: 'LIABILITY', is_active: true, parent_account_id: null },
  { id: 6, code: '2100', name: 'Accounts Payable', type: 'LIABILITY', is_active: true, parent_account_id: 5 },
  { id: 7, code: '2200', name: 'Tax Payable', type: 'LIABILITY', is_active: true, parent_account_id: 5 },
  { id: 8, code: '3000', name: 'Equity', type: 'EQUITY', is_active: true, parent_account_id: null },
  { id: 9, code: '3100', name: 'Owner Capital', type: 'EQUITY', is_active: true, parent_account_id: 8 },
  { id: 10, code: '4000', name: 'Revenue', type: 'REVENUE', is_active: true, parent_account_id: null },
  { id: 11, code: '4100', name: 'POS Food & Beverage Sales', type: 'REVENUE', is_active: true, parent_account_id: 10 },
  { id: 12, code: '5000', name: 'Expenses', type: 'EXPENSE', is_active: true, parent_account_id: null },
  { id: 13, code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', is_active: true, parent_account_id: 12 },
  { id: 14, code: '5200', name: 'Waste & Shrinkage Expense', type: 'EXPENSE', is_active: true, parent_account_id: 12 },
  { id: 15, code: '5300', name: 'Inventory Adjustment Variance', type: 'EXPENSE', is_active: true, parent_account_id: 12 },
];

@ApiTags('Ledger Accounts Setup')
@ApiBearerAuth()
@Controller('ledger-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LedgerAccountsController {
  @Get()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Get ledger accounts directory' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  async getAccounts(
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    let filtered = [...MOCK_LEDGER_ACCOUNTS];

    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (a) => a.code.toLowerCase().includes(term) || a.name.toLowerCase().includes(term),
      );
    }

    if (type) {
      filtered = filtered.filter((a) => a.type === type);
    }

    return {
      data: filtered,
      total: filtered.length,
    };
  }

  @Post()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB)
  @ApiOperation({ summary: 'Create new ledger account' })
  async createAccount(@Body() dto: Partial<LedgerAccountDto>) {
    const newAccount: LedgerAccountDto = {
      id: Date.now(),
      code: dto.code || `9${Math.floor(100 + Math.random() * 900)}`,
      name: dto.name || 'New Ledger Account',
      type: dto.type || 'ASSET',
      is_active: true,
      parent_account_id: dto.parent_account_id ?? null,
    };

    MOCK_LEDGER_ACCOUNTS.push(newAccount);
    return { data: newAccount };
  }

  @Patch(':id')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB)
  @ApiOperation({ summary: 'Update ledger account' })
  async updateAccount(
    @Param('id') id: string,
    @Body() dto: Partial<LedgerAccountDto>,
  ) {
    const numericId = Number(id);
    const account = MOCK_LEDGER_ACCOUNTS.find((a) => a.id === numericId);

    if (!account) {
      throw new NotFoundException(`Ledger account #${id} not found`);
    }

    if (dto.code !== undefined) account.code = dto.code;
    if (dto.name !== undefined) account.name = dto.name;
    if (dto.type !== undefined) account.type = dto.type;
    if (dto.is_active !== undefined) account.is_active = dto.is_active;
    if (dto.parent_account_id !== undefined) account.parent_account_id = dto.parent_account_id;

    return { data: account };
  }
}
