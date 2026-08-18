import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, IsNull } from 'typeorm';
import { CashDrawer } from './entities/cash-drawer.entity';
import { Shift } from '../../shift/shifts/entities/shift.entity';
import { Collaborator } from 'src/finance-hr/hr/collaborators/entities/collaborator.entity';
import { CreateCashDrawerDto } from './dto/create-cash-drawer.dto';
import { CloseCashDrawerDto } from './dto/close-cash-drawer.dto';
import { GetCashDrawersQueryDto } from './dto/get-cash-drawers-query.dto';
import {
  CashDrawerResponseDto,
  OneCashDrawerResponseDto,
  AllCashDrawersResponseDto,
} from './dto/cash-drawer-response.dto';
import { PaginatedCashDrawersResponseDto } from './dto/paginated-cash-drawers-response.dto';
import { CashDrawerStatus } from './constants/cash-drawer-status.enum';
import { ShiftStatus } from '../../shift/shifts/constants/shift-status.enum';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { CashDrawerHistoryService } from '../cash-drawer-history/cash-drawer-history.service';

@Injectable()
export class CashDrawersService {
  constructor(
    @InjectRepository(CashDrawer)
    private readonly cashDrawerRepository: Repository<CashDrawer>,
    @InjectRepository(Shift)
    private readonly shiftRepository: Repository<Shift>,
    @InjectRepository(Collaborator)
    private readonly collaboratorRepository: Repository<Collaborator>,
    private readonly cashDrawerHistoryService: CashDrawerHistoryService,
  ) {}

  async create(
    createCashDrawerDto: CreateCashDrawerDto,
    user: AuthenticatedUser,
  ): Promise<OneCashDrawerResponseDto> {
    const authenticatedUserMerchantId = user?.merchant?.id;

    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to create cash drawers',
      );
    }

    if (createCashDrawerDto.openingBalance < 0) {
      throw new BadRequestException('Opening balance must be non-negative');
    }

    // NOTE: ShiftsService.findActiveShiftByMerchant() has the identical unordered-lookup
    // pattern; keep both in sync if this changes.
    const activeShift = await this.shiftRepository.findOne({
      where: {
        merchant: { id: authenticatedUserMerchantId },
        status: ShiftStatus.ACTIVE,
      },
      order: { startTime: 'DESC', id: 'DESC' },
    });

    if (!activeShift) {
      throw new BadRequestException(
        'No active shift found. Start a shift before opening a cash drawer.',
      );
    }

    const collaborator = await this.resolveCollaborator(
      user.id,
      authenticatedUserMerchantId,
    );

    const cashDrawer = new CashDrawer();
    cashDrawer.merchant_id = authenticatedUserMerchantId;
    cashDrawer.shift_id = activeShift.id;
    cashDrawer.opening_balance = createCashDrawerDto.openingBalance;
    cashDrawer.current_balance = createCashDrawerDto.openingBalance;
    cashDrawer.closing_balance = null;
    cashDrawer.opened_by = collaborator.id;
    cashDrawer.closed_by = null;
    cashDrawer.status = CashDrawerStatus.OPEN;

    const savedCashDrawer = await this.cashDrawerRepository.save(cashDrawer);

    const completeCashDrawer = await this.cashDrawerRepository.findOne({
      where: { id: savedCashDrawer.id },
      relations: [
        'merchant',
        'shift',
        'shift.merchant',
        'openedByCollaborator',
        'closedByCollaborator',
      ],
    });

    if (!completeCashDrawer) {
      throw new NotFoundException('Cash drawer not found after creation');
    }

    return {
      statusCode: 201,
      message: 'Cash drawer created successfully',
      data: this.formatCashDrawerResponse(completeCashDrawer),
    };
  }

  async findAll(
    query: GetCashDrawersQueryDto,
    authenticatedUserMerchantId: number,
  ): Promise<PaginatedCashDrawersResponseDto> {
    // Validate user has merchant
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to access cash drawers',
      );
    }

    // Validate pagination parameters
    if (query.page && query.page < 1) {
      throw new BadRequestException('Page number must be greater than 0');
    }

    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    // Validate date format if provided
    if (query.createdDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(query.createdDate)) {
        throw new BadRequestException(
          'Created date must be in YYYY-MM-DD format',
        );
      }
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    // Build where conditions
    const whereConditions: any = {
      merchant_id: authenticatedUserMerchantId,
    };

    if (query.shiftId) {
      // Validate shift exists and belongs to merchant
      const shift = await this.shiftRepository.findOne({
        where: { id: query.shiftId },
        relations: ['merchant'],
      });
      if (!shift) {
        throw new NotFoundException(`Shift with ID ${query.shiftId} not found`);
      }
      if (shift.merchant.id !== authenticatedUserMerchantId) {
        throw new ForbiddenException('Shift does not belong to your merchant');
      }
      whereConditions.shift_id = query.shiftId;
    }

    if (query.openedBy) {
      // Validate collaborator exists and belongs to merchant
      const collaborator = await this.collaboratorRepository.findOne({
        where: { id: query.openedBy },
      });
      if (!collaborator) {
        throw new NotFoundException(
          `Collaborator with ID ${query.openedBy} not found`,
        );
      }
      if (collaborator.merchant_id !== authenticatedUserMerchantId) {
        throw new ForbiddenException(
          'Collaborator does not belong to your merchant',
        );
      }
      whereConditions.opened_by = query.openedBy;
    }

    if (query.closedBy) {
      // Validate collaborator exists and belongs to merchant
      const collaborator = await this.collaboratorRepository.findOne({
        where: { id: query.closedBy },
      });
      if (!collaborator) {
        throw new NotFoundException(
          `Collaborator with ID ${query.closedBy} not found`,
        );
      }
      if (collaborator.merchant_id !== authenticatedUserMerchantId) {
        throw new ForbiddenException(
          'Collaborator does not belong to your merchant',
        );
      }
      whereConditions.closed_by = query.closedBy;
    }

    // If status is explicitly provided, use it; otherwise show all cash drawers
    if (query.status !== undefined) {
      whereConditions.status = query.status;
    }

    if (query.createdDate) {
      const startDate = new Date(query.createdDate);
      const endDate = new Date(query.createdDate);
      endDate.setDate(endDate.getDate() + 1);
      whereConditions.created_at = Between(startDate, endDate);
    }

    // Build order conditions
    const orderConditions: any = {};
    if (query.sortBy) {
      const sortField =
        query.sortBy === 'openingBalance'
          ? 'opening_balance'
          : query.sortBy === 'closingBalance'
            ? 'closing_balance'
            : query.sortBy === 'createdAt'
              ? 'created_at'
              : query.sortBy === 'updatedAt'
                ? 'updated_at'
                : 'id';
      orderConditions[sortField] = query.sortOrder || 'DESC';
    } else {
      orderConditions.created_at = 'DESC';
    }

    // Execute query
    const [cashDrawers, total] = await this.cashDrawerRepository.findAndCount({
      where: whereConditions,
      relations: [
        'merchant',
        'shift',
        'shift.merchant',
        'openedByCollaborator',
        'closedByCollaborator',
      ],
      order: orderConditions,
      skip,
      take: limit,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const paginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    };

    return {
      statusCode: 200,
      message: 'Cash drawers retrieved successfully',
      data: cashDrawers.map((cashDrawer) =>
        this.formatCashDrawerResponse(cashDrawer),
      ),
      paginationMeta,
    };
  }

  async findOne(
    id: number,
    authenticatedUserMerchantId: number,
  ): Promise<OneCashDrawerResponseDto> {
    // Validate ID
    if (!id || id <= 0) {
      throw new BadRequestException(
        'Cash drawer ID must be a valid positive number',
      );
    }

    // Validate user has merchant
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to access cash drawers',
      );
    }

    // Find cash drawer (show all cash drawers regardless of status)
    const cashDrawer = await this.cashDrawerRepository.findOne({
      where: {
        id,
        merchant_id: authenticatedUserMerchantId,
      },
      relations: [
        'merchant',
        'shift',
        'shift.merchant',
        'openedByCollaborator',
        'closedByCollaborator',
      ],
    });

    if (!cashDrawer) {
      throw new NotFoundException('Cash drawer not found');
    }

    // Validate merchant ownership
    if (cashDrawer.merchant_id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only access cash drawers from your merchant',
      );
    }

    return {
      statusCode: 200,
      message: 'Cash drawer retrieved successfully',
      data: this.formatCashDrawerResponse(cashDrawer),
    };
  }

  async update(
    id: number,
    closeCashDrawerDto: CloseCashDrawerDto,
    user: AuthenticatedUser,
  ): Promise<OneCashDrawerResponseDto> {
    if (!id || id <= 0) {
      throw new BadRequestException(
        'Cash drawer ID must be a valid positive number',
      );
    }

    const authenticatedUserMerchantId = user?.merchant?.id;
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to update cash drawers',
      );
    }

    const existingCashDrawer = await this.cashDrawerRepository.findOne({
      where: { id },
      relations: [
        'merchant',
        'shift',
        'shift.merchant',
        'openedByCollaborator',
        'closedByCollaborator',
      ],
    });

    if (!existingCashDrawer) {
      throw new NotFoundException('Cash drawer not found');
    }

    if (existingCashDrawer.merchant_id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only update cash drawers from your merchant',
      );
    }

    if (existingCashDrawer.status !== CashDrawerStatus.OPEN) {
      throw new ConflictException('Only an open cash drawer can be closed');
    }

    if (closeCashDrawerDto.closingBalance < 0) {
      throw new BadRequestException('Closing balance must be non-negative');
    }

    const collaborator = await this.resolveCollaborator(
      user.id,
      authenticatedUserMerchantId,
    );

    // `current_balance`/`closingBalance` can arrive as numeric strings (decimal
    // column), so coerce both sides before comparing. Both sides are also rounded
    // to 2 decimal places (matching the decimal(12,2) column) so sub-cent noise in
    // the incoming DTO value doesn't cause a false Discrepancy.
    const currentBalance = Number(existingCashDrawer.current_balance);
    const closingBalance =
      Math.round(Number(closeCashDrawerDto.closingBalance) * 100) / 100;
    const status =
      closingBalance === Math.round(currentBalance * 100) / 100
        ? CashDrawerStatus.CLOSE
        : CashDrawerStatus.DISCREPANCY;

    await this.cashDrawerRepository.update(id, {
      closing_balance: closingBalance,
      closed_by: collaborator.id,
      status,
    });

    try {
      await this.cashDrawerHistoryService.create(
        {
          cashDrawerId: id,
          openingBalance: Number(existingCashDrawer.opening_balance),
          closingBalance: closingBalance,
          openedBy: existingCashDrawer.opened_by,
          closedBy: collaborator.id,
        },
        authenticatedUserMerchantId,
      );
    } catch (err) {
      // Log warning if history snapshot creation encounters an issue, but complete the drawer update
      console.warn(`[CashDrawersService] Failed to persist history record for CD #${id}:`, err);
    }

    const updatedCashDrawer = await this.cashDrawerRepository.findOne({
      where: { id },
      relations: [
        'merchant',
        'shift',
        'shift.merchant',
        'openedByCollaborator',
        'closedByCollaborator',
      ],
    });

    if (!updatedCashDrawer) {
      throw new NotFoundException('Cash drawer not found after update');
    }

    return {
      statusCode: 200,
      message: 'Cash drawer updated successfully',
      data: this.formatCashDrawerResponse(updatedCashDrawer),
    };
  }

  async remove(
    id: number,
    authenticatedUserMerchantId: number,
  ): Promise<OneCashDrawerResponseDto> {
    // Validate ID
    if (!id || id <= 0) {
      throw new BadRequestException(
        'Cash drawer ID must be a valid positive number',
      );
    }

    // Validate user has merchant
    if (!authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You must be associated with a merchant to delete cash drawers',
      );
    }

    // Find existing cash drawer
    const existingCashDrawer = await this.cashDrawerRepository.findOne({
      where: {
        id,
      },
      relations: [
        'merchant',
        'shift',
        'shift.merchant',
        'openedByCollaborator',
        'closedByCollaborator',
      ],
    });

    if (!existingCashDrawer) {
      throw new NotFoundException('Cash drawer not found');
    }

    // Validate merchant ownership
    if (existingCashDrawer.merchant_id !== authenticatedUserMerchantId) {
      throw new ForbiddenException(
        'You can only delete cash drawers from your merchant',
      );
    }

    // Perform physical deletion (or you can implement soft delete with a different field)
    await this.cashDrawerRepository.remove(existingCashDrawer);

    return {
      statusCode: 200,
      message: 'Cash drawer deleted successfully',
      data: this.formatCashDrawerResponse(existingCashDrawer),
    };
  }

  private async resolveCollaborator(
    userId: number,
    merchantId: number,
  ): Promise<Collaborator> {
    const collaborator = await this.collaboratorRepository.findOne({
      where: { user_id: userId, merchant_id: merchantId },
    });

    if (!collaborator) {
      throw new BadRequestException(
        'No collaborator profile is linked to your account.',
      );
    }

    return collaborator;
  }

  private formatCashDrawerResponse(
    cashDrawer: CashDrawer,
  ): CashDrawerResponseDto {
    return {
      id: cashDrawer.id,
      openingBalance: cashDrawer.opening_balance,
      currentBalance: cashDrawer.current_balance,
      closingBalance: cashDrawer.closing_balance,
      createdAt: cashDrawer.created_at,
      updatedAt: cashDrawer.updated_at,
      status: cashDrawer.status,
      merchant: cashDrawer.merchant
        ? {
            id: cashDrawer.merchant.id,
            name: cashDrawer.merchant.name,
          }
        : {
            id: cashDrawer.merchant_id,
            name: 'Merchant',
          },
      shift: cashDrawer.shift
        ? {
            id: cashDrawer.shift.id,
            name: `Shift ${cashDrawer.shift.id}`,
            startTime: cashDrawer.shift.startTime,
            endTime: cashDrawer.shift.endTime || new Date(),
            status: cashDrawer.shift.status,
            merchant: {
              id: cashDrawer.shift.merchant?.id ?? cashDrawer.merchant?.id ?? cashDrawer.merchant_id,
              name: cashDrawer.shift.merchant?.name ?? cashDrawer.merchant?.name ?? 'Merchant',
            },
          }
        : ({
            id: cashDrawer.shift_id || 0,
            name: `Shift ${cashDrawer.shift_id || 0}`,
            startTime: cashDrawer.created_at,
            endTime: cashDrawer.updated_at,
            status: 'ACTIVE',
            merchant: {
              id: cashDrawer.merchant?.id ?? cashDrawer.merchant_id,
              name: cashDrawer.merchant?.name ?? 'Merchant',
            },
          } as any),
      openedByCollaborator: cashDrawer.openedByCollaborator
        ? {
            id: cashDrawer.openedByCollaborator.id,
            name: cashDrawer.openedByCollaborator.name,
            role: cashDrawer.openedByCollaborator.role,
          }
        : {
            id: cashDrawer.opened_by,
            name: `Collaborator ${cashDrawer.opened_by}`,
            role: 'WAITER',
          },
      closedByCollaborator: cashDrawer.closedByCollaborator
        ? {
            id: cashDrawer.closedByCollaborator.id,
            name: cashDrawer.closedByCollaborator.name,
            role: cashDrawer.closedByCollaborator.role,
          }
        : null,
    };
  }
}
