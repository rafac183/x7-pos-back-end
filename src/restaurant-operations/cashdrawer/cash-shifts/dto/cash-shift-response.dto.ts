// Response DTO for Cash Shift entity and calculations
import { CashShiftStatus } from '../constants/cash-shift-status.enum';
import { CashMovementResponseDto } from '../../cash-movements/dto/cash-movement-response.dto';

export class BasicCollaboratorInfoDto {
  id: number;
  name: string;
  role: string;
}

export class CashShiftResponseDto {
  id: number;
  merchantId: number;
  cashDrawerId: number;
  openedByCollaborator: BasicCollaboratorInfoDto;
  closedByCollaborator: BasicCollaboratorInfoDto | null;
  openingBalance: number;
  systemAmount: number | null;
  declaredAmount: number | null;
  difference: number | null;
  status: CashShiftStatus;
  openedAt: Date;
  closedAt: Date | null;
  salesSummary?: { method: string; amount: number }[];
  expenses?: CashMovementResponseDto[];
  totalExpenses?: number;
  manualInflows?: CashMovementResponseDto[];
  totalManualInflows?: number;
}

export class OneCashShiftResponseDto {
  statusCode: number;
  message: string;
  data: CashShiftResponseDto;
}

export class AllCashShiftsResponseDto {
  statusCode: number;
  message: string;
  data: CashShiftResponseDto[];
}
