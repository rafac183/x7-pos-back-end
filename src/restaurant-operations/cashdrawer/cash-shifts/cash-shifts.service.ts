// Cash Shifts Service implementation for drawer and shift management
import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CashShift } from './entities/cash-shift.entity';
import { CashShiftStatus } from './constants/cash-shift-status.enum';
import { CashDrawer } from '../cash-drawers/entities/cash-drawer.entity';
import { CashDrawerStatus } from '../cash-drawers/constants/cash-drawer-status.enum';
import { Merchant } from '../../../platform-saas/merchants/entities/merchant.entity';
import { Collaborator } from '../../../finance-hr/hr/collaborators/entities/collaborator.entity';
import { CashShiftRepository } from './cash-shift.repository';
import { CreateCashShiftDto } from './dto/create-cash-shift.dto';
import { CloseCashShiftDto } from './dto/close-cash-shift.dto';
import { ManualCashTransactionDto } from './dto/manual-cash-transaction.dto';
import { CashShiftMovementType } from './constants/cash-shift-movement-type.enum';
import { CashFlowService } from './cash-flow.service';
import {
  CashShiftResponseDto,
  OneCashShiftResponseDto,
  AllCashShiftsResponseDto,
} from './dto/cash-shift-response.dto';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../../platform-saas/users/constants/role.enum';
import { CashMovement } from '../cash-movements/entities/cash-movement.entity';
import { CashMovementType } from '../cash-movements/constants/cash-movement-type.enum';

@Injectable()
export class CashShiftsService {
  constructor(
    @InjectRepository(CashDrawer)
    private readonly cashDrawerRepo: Repository<CashDrawer>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepo: Repository<Collaborator>,
    private readonly cashShiftRepo: CashShiftRepository,
    private readonly dataSource: DataSource,
    private readonly cashFlowService: CashFlowService,
  ) {}

  // ── Private helpers ─────────────────────────────────────────────────────────

  private format(
    shift: CashShift,
    salesSummary?: { method: string; amount: number }[],
    movements?: CashMovement[],
  ): CashShiftResponseDto {
    const mappedMovements = movements || shift.cashMovements || [];

    const expenses = mappedMovements.filter(
      (m) => m.type === CashMovementType.OUTFLOW,
    );
    const totalExpenses = expenses.reduce(
      (sum, m) => sum + Number(m.amount),
      0,
    );

    const manualInflows = mappedMovements.filter(
      (m) => m.type === CashMovementType.INFLOW,
    );
    const totalManualInflows = manualInflows.reduce(
      (sum, m) => sum + Number(m.amount),
      0,
    );

    const formatMovement = (m: CashMovement) => ({
      id: m.id,
      shiftId: m.shiftId,
      amount: Number(m.amount),
      reason: m.reason,
      receiptPhoto: m.receiptPhoto,
      userId: m.userId,
      type: m.type,
      createdAt: m.createdAt,
    });

    return {
      id: shift.id,
      merchantId: shift.merchantId,
      cashDrawerId: shift.cashDrawerId,
      openedByCollaborator: shift.openedByCollaborator
        ? {
            id: shift.openedByCollaborator.id,
            name: shift.openedByCollaborator.name,
            role: shift.openedByCollaborator.role,
          }
        : { id: shift.openedBy, name: 'Unknown', role: '—' },
      closedByCollaborator: shift.closedByCollaborator
        ? {
            id: shift.closedByCollaborator.id,
            name: shift.closedByCollaborator.name,
            role: shift.closedByCollaborator.role,
          }
        : null,
      openingBalance: Number(shift.openingBalance),
      systemAmount:
        shift.systemAmount !== null ? Number(shift.systemAmount) : null,
      declaredAmount:
        shift.declaredAmount !== null ? Number(shift.declaredAmount) : null,
      difference: shift.difference !== null ? Number(shift.difference) : null,
      status: shift.status,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      salesSummary,
      totalExpenses,
      expenses: expenses.map(formatMovement),
      manualInflows: manualInflows.map(formatMovement),
      totalManualInflows,
    };
  }

  // ── Operations ──────────────────────────────────────────────────────────────

  /**
   * Opens a new cash shift for the merchant.
   * Rules:
   *  - The merchant cannot have another OPEN shift at the same time.
   *  - The cash drawer must be OPEN and belong to the merchant.
   */
  async openShift(
    dto: CreateCashShiftDto,
    user: AuthenticatedUser,
  ): Promise<OneCashShiftResponseDto> {
    const merchantId = user.merchant?.id;
    if (!merchantId) {
      throw new ForbiddenException('User must belong to a merchant');
    }

    const collaborator = await this.collaboratorRepo.findOne({
      where: { user_id: user.id, merchant_id: merchantId },
    });
    if (!collaborator) {
      throw new ForbiddenException(
        'Your user account is not linked to any collaborator record. Cannot open cash shift.',
      );
    }

    // Validate that the cash drawer does not already have an active shift
    const existingDrawerShift = await this.cashShiftRepo.findOne({
      where: { cashDrawerId: dto.cashDrawerId, status: CashShiftStatus.OPEN },
    });
    if (existingDrawerShift) {
      throw new ConflictException(
        `Cash Drawer #${dto.cashDrawerId} already has an active shift session (#CS-${existingDrawerShift.id}) in progress. Please close the active shift before opening a new one.`,
      );
    }

    // Validate cash drawer
    const cashDrawer = await this.cashDrawerRepo.findOne({
      where: { id: dto.cashDrawerId },
    });
    if (!cashDrawer) {
      throw new NotFoundException(
        `Cash drawer with ID ${dto.cashDrawerId} not found`,
      );
    }
    if (cashDrawer.merchant_id !== merchantId) {
      throw new ForbiddenException(
        'The cash drawer does not belong to your merchant',
      );
    }
    if (cashDrawer.status !== CashDrawerStatus.OPEN) {
      throw new BadRequestException(
        'The cash drawer must be in OPEN status to open a cash shift',
      );
    }

    const shift = this.cashShiftRepo.create({
      merchantId,
      cashDrawerId: dto.cashDrawerId,
      openedBy: collaborator.id,
      closedBy: null,
      openingBalance: dto.openingBalance,
      systemAmount: null,
      declaredAmount: null,
      difference: null,
      status: CashShiftStatus.OPEN,
      closedAt: null,
    });

    const saved = await this.cashShiftRepo.save(shift);

    const shiftWithRelations = await this.cashShiftRepo.findOne({
      where: { id: saved.id },
      relations: ['openedByCollaborator', 'closedByCollaborator'],
    });

    return {
      statusCode: 201,
      message: 'Cash shift opened successfully',
      data: this.format(shiftWithRelations || saved),
    };
  }

  /**
   * Cash shift closing process (Process Flow from TAC):
   *
   * 1. Gets the shift (validates OPEN + merchant ownership).
   * 2. Calls getLiveBalance() -> DB engine calculates systemAmount.
   * 3. Calculates difference = declaredAmount - systemAmount.
   * 4. Updates the shift with all closing fields.
   * 5. Returns the processed closing object.
   */
  async closeShift(
    shiftId: number,
    dto: CloseCashShiftDto,
    user: AuthenticatedUser,
  ): Promise<OneCashShiftResponseDto> {
    const merchantId = user.merchant?.id;
    if (!merchantId) {
      throw new ForbiddenException('User must belong to a merchant');
    }

    const shift = await this.cashShiftRepo.findOne({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException(`Cash shift with ID ${shiftId} not found`);
    }

    if (shift.merchantId !== merchantId) {
      throw new ForbiddenException(
        'You can only close cash shifts belonging to your merchant',
      );
    }

    if (shift.status !== CashShiftStatus.OPEN) {
      throw new BadRequestException(
        `The cash shift is already ${shift.status.toLowerCase()}. Only OPEN cash shifts can be closed.`,
      );
    }

    const collaborator = await this.collaboratorRepo.findOne({
      where: { user_id: user.id, merchant_id: merchantId },
    });
    if (!collaborator) {
      throw new ForbiddenException(
        'Your user account is not linked to any collaborator record. Cannot close cash shift.',
      );
    }

    // Enforce CAT 3: MERCHANT_USER can only close their own shift
    if (user.role === UserRole.MERCHANT_USER && shift.openedBy !== collaborator.id) {
      throw new ForbiddenException(
        'You are not authorized to close this cash shift. You can only close your own active cash shifts.',
      );
    }

    // Step 1: obtain systemAmount from the DB (delegated 100% to SQL engine)
    const rawSystemAmount = await this.cashShiftRepo.getLiveBalance(shiftId);

    // Step 2: round both sides to cents before comparing/persisting — the
    // declared amount is user-entered and the live balance is SQL-summed
    // decimal(12,2) data, so sub-cent floating point noise on either side
    // must not manufacture a false Discrepancy.
    const systemAmount = Math.round(rawSystemAmount * 100) / 100;
    const declaredAmount = Math.round(Number(dto.declaredAmount) * 100) / 100;
    const difference = Math.round((declaredAmount - systemAmount) * 100) / 100;
    const status =
      difference === 0 ? CashShiftStatus.CLOSED : CashShiftStatus.DISCREPANCY;

    // Step 3 & 4: update the record with closing data
    shift.systemAmount = systemAmount;
    shift.declaredAmount = declaredAmount;
    shift.difference = difference;
    shift.closedBy = collaborator.id;
    shift.closedAt = new Date();
    shift.status = status;

    const closed = await this.cashShiftRepo.save(shift);
    const shiftWithRelations = await this.cashShiftRepo.findOne({
      where: { id: shiftId },
      relations: ['cashMovements', 'openedByCollaborator', 'closedByCollaborator'],
    });
    const salesSummary = await this.cashShiftRepo.getSalesSummary(shiftId);

    return {
      statusCode: 200,
      message: 'Cash shift closed successfully',
      data: this.format(shiftWithRelations || closed, salesSummary),
    };
  }

  /**
   * Registers a manual transaction (Income/Expense) to the active shift.
   * Implementing CAT 1: OUT flows cannot exceed live balance.
   * CAT 2: Records collaboratorId.
   * CAT 3: Handled by movement type OUT/IN, decoupled from SALES.
   */
  async addManualTransaction(
    shiftId: number,
    dto: ManualCashTransactionDto,
    merchantId: number,
  ) {
    if (!merchantId) {
      throw new ForbiddenException('User must belong to a merchant');
    }

    const shift = await this.cashShiftRepo.findOne({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException(`Cash shift with ID ${shiftId} not found`);
    }

    if (shift.merchantId !== merchantId) {
      throw new ForbiddenException(
        'You can only modify cash shifts belonging to your merchant',
      );
    }

    if (shift.status !== CashShiftStatus.OPEN) {
      throw new BadRequestException(
        `The cash shift is ${shift.status.toLowerCase()}. You can only add transactions to an OPEN shift.`,
      );
    }

    // Validate collaborator
    const collaborator = await this.collaboratorRepo.findOne({
      where: { id: dto.collaboratorId, merchant_id: merchantId },
    });
    if (!collaborator) {
      throw new NotFoundException(
        `Collaborator with ID ${dto.collaboratorId} not found or does not belong to your merchant`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Re-fetch shift with lock to prevent race conditions during OUT flows (Double Spend prevention)
      const lockedShift = await queryRunner.manager.findOne(CashShift, {
        where: { id: shiftId, status: CashShiftStatus.OPEN },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedShift) {
        throw new BadRequestException(
          'The active cash shift has been closed or is unavailable.',
        );
      }

      // CAT 1: Ensure OUT flows do not exceed current live balance
      if (dto.type === CashShiftMovementType.OUT) {
        // In a transaction, we use the QueryBuilder associated with the transactional EntityManager
        const result = await queryRunner.manager
          .createQueryBuilder(CashShift, 'cs')
          .leftJoin(
            'cash_transactions',
            'ct',
            'ct.shift_id = cs.id AND ct.status = :activeStatus',
            { activeStatus: 'active' },
          )
          .select(
            `(
              COALESCE(cs.opening_balance, 0)
              + COALESCE(SUM(CASE WHEN ct.type IN ('sale', 'adjustment_up') THEN ct.amount ELSE 0 END), 0)
              - COALESCE(SUM(CASE WHEN ct.type IN ('refund', 'withdrawal', 'adjustment_down') THEN ct.amount ELSE 0 END), 0)
            )`,
            'liveBalance',
          )
          .where('cs.id = :shiftId', { shiftId: lockedShift.id })
          .groupBy('cs.id')
          .addGroupBy('cs.opening_balance')
          .getRawOne<{ liveBalance: string }>();

        const liveBalance = result
          ? Number(result.liveBalance)
          : Number(lockedShift.openingBalance);

        if (dto.amount > liveBalance) {
          throw new BadRequestException(
            `Cannot process OUT flow of ${dto.amount}. The till only has ${liveBalance} available.`,
          );
        }
      }

      const transaction = await this.cashFlowService.addMovement(
        lockedShift.id,
        dto.amount,
        dto.type,
        null,
        dto.collaboratorId,
        lockedShift.cashDrawerId,
        queryRunner.manager,
        dto.reason,
      );

      await queryRunner.commitTransaction();

      return {
        statusCode: 201,
        message: 'Manual transaction registered successfully',
        data: transaction,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** Finds the active (OPEN) cash shift for the merchant. */
  async findActiveShift(merchantId: number): Promise<OneCashShiftResponseDto> {
    if (!merchantId) {
      throw new ForbiddenException('User must belong to a merchant');
    }

    const shift = await this.cashShiftRepo.findOne({
      where: { merchantId, status: CashShiftStatus.OPEN },
      relations: ['cashMovements', 'openedByCollaborator', 'closedByCollaborator'],
    });

    if (!shift) {
      throw new NotFoundException(
        'No active cash shift found for this merchant',
      );
    }

    // Calculate the theoretical balance in real time
    shift.systemAmount = await this.cashShiftRepo.getLiveBalance(shift.id);

    const salesSummary = await this.cashShiftRepo.getSalesSummary(shift.id);

    return {
      statusCode: 200,
      message: 'Active cash shift found',
      data: this.format(shift, salesSummary),
    };
  }

  /** Lists all cash shifts for the merchant. */
  async findAll(merchantId: number): Promise<AllCashShiftsResponseDto> {
    if (!merchantId) {
      throw new ForbiddenException('User must belong to a merchant');
    }

    const shifts = await this.cashShiftRepo.find({
      where: { merchantId },
      relations: ['cashMovements', 'openedByCollaborator', 'closedByCollaborator'],
      order: { openedAt: 'DESC' },
    });

    // Dynamically calculate the theoretical balance for open shifts
    for (const shift of shifts) {
      if (shift.status === CashShiftStatus.OPEN) {
        shift.systemAmount = await this.cashShiftRepo.getLiveBalance(shift.id);
      }
    }

    return {
      statusCode: 200,
      message: 'Cash shifts retrieved successfully',
      data: shifts.map((s) => this.format(s)),
    };
  }

  /** Gets a cash shift by ID. */
  async findOne(
    id: number,
    merchantId: number,
  ): Promise<OneCashShiftResponseDto> {
    if (!merchantId) {
      throw new ForbiddenException('User must belong to a merchant');
    }

    const shift = await this.cashShiftRepo.findOne({
      where: { id },
      relations: ['cashMovements', 'openedByCollaborator', 'closedByCollaborator'],
    });

    if (!shift) {
      throw new NotFoundException(`Cash shift with ID ${id} not found`);
    }

    if (shift.merchantId !== merchantId) {
      throw new ForbiddenException(
        'You can only view cash shifts belonging to your merchant',
      );
    }

    // Dynamically calculate the theoretical balance if the shift is open
    if (shift.status === CashShiftStatus.OPEN) {
      shift.systemAmount = await this.cashShiftRepo.getLiveBalance(id);
    }

    const salesSummary = await this.cashShiftRepo.getSalesSummary(id);

    return {
      statusCode: 200,
      message: 'Cash shift retrieved successfully',
      data: this.format(shift, salesSummary),
    };
  }
}
