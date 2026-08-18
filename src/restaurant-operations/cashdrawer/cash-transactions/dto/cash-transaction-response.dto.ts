import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from '../../../../common/dtos/success-response.dto';
import { CashTransactionStatus } from '../constants/cash-transaction-status.enum';
import { CashTransactionType } from '../constants/cash-transaction-type.enum';
import { CashShiftStatus } from 'src/restaurant-operations/cashdrawer/cash-shifts/constants/cash-shift-status.enum';
import { BasicCollaboratorInfoDto } from 'src/restaurant-operations/cashdrawer/cash-shifts/dto/cash-shift-response.dto';
import { LoyaltyPointsSource } from 'src/growth/loyalty/loyalty-points-transaction/constants/loyalty-points-source.enum';

export class CashTransactionResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 10 })
  cashDrawerId: number;

  @ApiProperty({ example: 200, nullable: true })
  orderId: number | null;

  @ApiProperty({ example: 'sale', enum: CashTransactionType })
  type: CashTransactionType;

  @ApiProperty({ example: 125.5 })
  amount: number;

  @ApiProperty({ example: 5 })
  collaboratorId: number;

  @ApiProperty({ example: 'active', enum: CashTransactionStatus })
  status: CashTransactionStatus;

  @ApiProperty({ example: 'Some notes', required: false })
  notes?: string | null;

  @ApiProperty({ example: '2024-01-15T08:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T09:00:00Z' })
  updatedAt: Date;
}

export class OneCashTransactionResponseDto extends SuccessResponse {
  @ApiProperty({ type: CashTransactionResponseDto })
  data: CashTransactionResponseDto;
}

export class PaginatedCashTransactionsResponseDto extends SuccessResponse {
  @ApiProperty({ type: [CashTransactionResponseDto] })
  data: CashTransactionResponseDto[];

  @ApiProperty({
    example: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  })
  paginationMeta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class CashTransactionLittleResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'sale', enum: CashTransactionType })
  type: CashTransactionType;

  @ApiProperty({ example: 125.5 })
  amount: number;
}

export class CashTransactionCashShiftDto {
  @ApiProperty({ example: 7 })
  id: number;

  @ApiProperty({ example: 'OPEN', enum: CashShiftStatus })
  status: CashShiftStatus;

  @ApiProperty({ example: '2024-01-15T07:00:00Z' })
  openedAt: Date;

  @ApiProperty({ example: '2024-01-15T20:00:00Z', nullable: true })
  closedAt: Date | null;

  @ApiProperty({ example: 1000.0 })
  openingBalance: number;

  @ApiProperty({ type: () => BasicCollaboratorInfoDto })
  openedByCollaborator: BasicCollaboratorInfoDto;

  @ApiProperty({ type: () => BasicCollaboratorInfoDto, nullable: true })
  closedByCollaborator: BasicCollaboratorInfoDto | null;
}

export class CashTransactionLoyaltyPointDto {
  @ApiProperty({ example: 55 })
  id: number;

  @ApiProperty({ example: 'Points earned from order', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'ORDER', enum: LoyaltyPointsSource })
  source: LoyaltyPointsSource;

  @ApiProperty({ example: 150 })
  points: number;

  @ApiProperty({ example: 3 })
  loyaltyCustomerId: number;

  @ApiProperty({ example: '2024-01-15T08:00:00Z' })
  createdAt: Date;
}

export class CashTransactionDetailResponseDto extends CashTransactionResponseDto {
  @ApiProperty({ type: () => BasicCollaboratorInfoDto })
  collaborator: BasicCollaboratorInfoDto;

  @ApiProperty({ type: () => CashTransactionCashShiftDto, nullable: true })
  cashShift: CashTransactionCashShiftDto | null;

  @ApiProperty({ type: () => CashTransactionLoyaltyPointDto, isArray: true })
  loyaltyPointTransactions: CashTransactionLoyaltyPointDto[];
}

export class OneCashTransactionDetailResponseDto extends SuccessResponse {
  @ApiProperty({ type: CashTransactionDetailResponseDto })
  data: CashTransactionDetailResponseDto;
}
