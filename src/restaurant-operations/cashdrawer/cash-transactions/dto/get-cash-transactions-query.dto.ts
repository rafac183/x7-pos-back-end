import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CashTransactionStatus } from '../constants/cash-transaction-status.enum';
import { CashTransactionType } from '../constants/cash-transaction-type.enum';

export enum CashTransactionSortBy {
  CREATED_AT = 'createdAt',
  AMOUNT = 'amount',
  TYPE = 'type',
  STATUS = 'status',
}

/**
 * Maps frontend display labels (UPPERCASE) to backend enum values (lowercase).
 * The frontend type selector uses labels like SALE, REFUND, PAY_IN, PAY_OUT,
 * DRAWER_DROP as logical groupings; we resolve them to the backend enum here.
 */
function normalizeType(value: string): string {
  if (!value) return value;
  const map: Record<string, CashTransactionType> = {
    SALE: CashTransactionType.SALE,
    REFUND: CashTransactionType.REFUND,
    PAY_IN: CashTransactionType.OPENING, // grouping — closest backend type
    PAY_OUT: CashTransactionType.WITHDRAWAL,
    DRAWER_DROP: CashTransactionType.WITHDRAWAL,
  };
  const upper = value.toUpperCase();
  return map[upper] ?? value.toLowerCase();
}

/**
 * Maps frontend status labels to backend CashTransactionStatus enum values.
 * VOIDED / AUDITED / RECONCILED are frontend-only display states; they are
 * not stored separately in the DB so we fall back to ACTIVE for them.
 */
function normalizeStatus(value: string): string {
  if (!value) return value;
  const lower = value.toLowerCase();
  if (lower === 'deleted') return CashTransactionStatus.DELETED;
  // All other values (ACTIVE, VOIDED, AUDITED, RECONCILED) map to active rows
  return CashTransactionStatus.ACTIVE;
}

export class GetCashTransactionsQueryDto {
  /**
   * Sent by the web client for context; the backend always derives the merchant
   * from the JWT so this param is whitelisted but intentionally ignored.
   */
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  merchantId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  cashDrawerId?: number;

  /**
   * Filter by cash shift ID.
   */
  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  shiftId?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  orderId?: number;

  /**
   * Accepts both the backend enum values (sale, refund, …) and the frontend
   * display labels (SALE, REFUND, PAY_IN, PAY_OUT, DRAWER_DROP).
   */
  @ApiPropertyOptional({ enum: CashTransactionType })
  @IsOptional()
  @Transform(({ value }) => normalizeType(value))
  @IsEnum(CashTransactionType)
  type?: CashTransactionType;

  /**
   * Accepts frontend display labels (ACTIVE, VOIDED, AUDITED, RECONCILED)
   * as well as the backend enum values (active, deleted).
   */
  @ApiPropertyOptional({ enum: CashTransactionStatus })
  @IsOptional()
  @Transform(({ value }) => normalizeStatus(value))
  @IsEnum(CashTransactionStatus)
  status?: CashTransactionStatus;

  /**
   * ISO date string (YYYY-MM-DD) for the start of the created_at range.
   */
  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsString()
  startDate?: string;

  /**
   * ISO date string (YYYY-MM-DD) for the end of the created_at range.
   */
  @ApiPropertyOptional({ example: '2024-01-31' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: CashTransactionSortBy })
  @IsOptional()
  @IsEnum(CashTransactionSortBy)
  sortBy?: CashTransactionSortBy;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], example: 'DESC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';
}
