import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { FeatureAccessGuard } from 'src/auth/guards/feature-access.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Scopes } from 'src/auth/decorators/scopes.decorator';
import { RequireFeature } from 'src/auth/decorators/require-feature.decorator';
import { SUBSCRIPTION_FEATURE_IDS } from 'src/common/subscription/subscription-feature-ids';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';
import { Request as ExpressRequest } from 'express';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';

export interface InventoryJournalLineResponse {
  id: number;
  postingDate: string;
  voucherNumber: string;
  referenceId: string;
  movementType: 'PURCHASE_RECEIPT' | 'POS_DEPLETION' | 'WASTE' | 'ADJUSTMENT';
  account: {
    id: number;
    code: string;
    name: string;
    category: 'ASSET' | 'EXPENSE' | 'LIABILITY' | 'EQUITY' | 'REVENUE';
  };
  debit: number;
  credit: number;
  memo: string;
}

@ApiTags('Inventory Journal Lines')
@ApiBearerAuth()
@Controller('v1/inventory/journal-lines')
@RequireFeature(SUBSCRIPTION_FEATURE_IDS.STOCK_AND_STOCK_MOVEMENTS)
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
export class InventoryJournalLinesController {
  @Get()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Get inventory accounting journal lines directory' })
  @ApiQuery({ name: 'merchantId', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'movementType', required: false, type: String })
  async getJournalLines(
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
    @Query('merchantId') queryMerchantId?: number,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('movementType') movementType?: string,
  ) {
    const merchantId = queryMerchantId || req.user?.merchant?.id;
    if (!merchantId) {
      throw new BadRequestException('User must have an active merchant session');
    }

    const allLines: InventoryJournalLineResponse[] = [
      {
        id: 1,
        postingDate: '2026-08-20',
        voucherNumber: 'INV-JE-1001',
        referenceId: 'PO-2026-089',
        movementType: 'PURCHASE_RECEIPT',
        account: {
          id: 1100,
          code: '1100',
          name: 'Raw Material Inventory',
          category: 'ASSET',
        },
        debit: 1250.00,
        credit: 0.00,
        memo: 'Stock receipt: 50.0 KG Flour 25kg bag via Purchase Order #PO-2026-089',
      },
      {
        id: 2,
        postingDate: '2026-08-20',
        voucherNumber: 'INV-JE-1001',
        referenceId: 'PO-2026-089',
        movementType: 'PURCHASE_RECEIPT',
        account: {
          id: 2100,
          code: '2100',
          name: 'Accounts Payable',
          category: 'LIABILITY',
        },
        debit: 0.00,
        credit: 1250.00,
        memo: 'Supplier Accounts Payable liability for Purchase Order #PO-2026-089',
      },
      {
        id: 3,
        postingDate: '2026-08-19',
        voucherNumber: 'INV-JE-1002',
        referenceId: 'POS-BATCH-1088',
        movementType: 'POS_DEPLETION',
        account: {
          id: 5100,
          code: '5100',
          name: 'Cost of Goods Sold',
          category: 'EXPENSE',
        },
        debit: 345.50,
        credit: 0.00,
        memo: 'Stock depletion: 15.5 KG Flour 25kg bag via POS Sales Order #1088',
      },
      {
        id: 4,
        postingDate: '2026-08-19',
        voucherNumber: 'INV-JE-1002',
        referenceId: 'POS-BATCH-1088',
        movementType: 'POS_DEPLETION',
        account: {
          id: 1100,
          code: '1100',
          name: 'Raw Material Inventory',
          category: 'ASSET',
        },
        debit: 0.00,
        credit: 345.50,
        memo: 'Raw material inventory reduction via POS Sales Order #1088',
      },
      {
        id: 5,
        postingDate: '2026-08-18',
        voucherNumber: 'INV-JE-1003',
        referenceId: 'WASTE-REF-042',
        movementType: 'WASTE',
        account: {
          id: 5200,
          code: '5200',
          name: 'Waste & Shrinkage Expense',
          category: 'EXPENSE',
        },
        debit: 88.00,
        credit: 0.00,
        memo: 'Inventory waste breakdown: 2.0 L Whole Milk (Expired batch)',
      },
      {
        id: 6,
        postingDate: '2026-08-18',
        voucherNumber: 'INV-JE-1003',
        referenceId: 'WASTE-REF-042',
        movementType: 'WASTE',
        account: {
          id: 1100,
          code: '1100',
          name: 'Raw Material Inventory',
          category: 'ASSET',
        },
        debit: 0.00,
        credit: 88.00,
        memo: 'Raw material inventory write-off for expired batch #042',
      },
      {
        id: 7,
        postingDate: '2026-08-17',
        voucherNumber: 'INV-JE-1004',
        referenceId: 'ADJ-REF-015',
        movementType: 'ADJUSTMENT',
        account: {
          id: 1100,
          code: '1100',
          name: 'Raw Material Inventory',
          category: 'ASSET',
        },
        debit: 150.00,
        credit: 0.00,
        memo: 'Physical count adjustment: System count 10 -> Actual count 15 (+5 units)',
      },
      {
        id: 8,
        postingDate: '2026-08-17',
        voucherNumber: 'INV-JE-1004',
        referenceId: 'ADJ-REF-015',
        movementType: 'ADJUSTMENT',
        account: {
          id: 5300,
          code: '5300',
          name: 'Inventory Adjustment Variance',
          category: 'EXPENSE',
        },
        debit: 0.00,
        credit: 150.00,
        memo: 'Physical count variance adjustment gain credit',
      },
    ];

    let filtered = [...allLines];

    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (l) =>
          l.account.code.toLowerCase().includes(term) ||
          l.account.name.toLowerCase().includes(term) ||
          l.memo.toLowerCase().includes(term) ||
          l.voucherNumber.toLowerCase().includes(term) ||
          l.referenceId.toLowerCase().includes(term),
      );
    }

    if (category) {
      filtered = filtered.filter((l) => l.account.category === category);
    }

    if (movementType) {
      filtered = filtered.filter((l) => l.movementType === movementType);
    }

    return {
      data: filtered,
      total: filtered.length,
    };
  }
}
