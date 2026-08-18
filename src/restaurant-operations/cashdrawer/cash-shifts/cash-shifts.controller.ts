import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiCreatedResponse, ApiOkResponse, ApiBadRequestResponse, ApiConflictResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CashShiftsService } from './cash-shifts.service';
import { CreateCashShiftDto } from './dto/create-cash-shift.dto';
import { CloseCashShiftDto } from './dto/close-cash-shift.dto';
import { ManualCashTransactionDto } from './dto/manual-cash-transaction.dto';
import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';

import { FeatureAccessGuard } from '../../../auth/guards/feature-access.guard';
import { RequireFeature } from '../../../auth/decorators/require-feature.decorator';
import { SUBSCRIPTION_FEATURE_IDS } from '../../../common/subscription/subscription-feature-ids';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { Scopes } from '../../../auth/decorators/scopes.decorator';
import { UserRole } from '../../../platform-saas/users/constants/role.enum';
import { Scope } from '../../../platform-saas/users/constants/scope.enum';

@ApiTags('Cash Shifts')
@ApiBearerAuth()
@RequireFeature(SUBSCRIPTION_FEATURE_IDS.CASH_DRAWERS)
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
@Controller('cash-shifts')
export class CashShiftsController {
  constructor(private readonly cashShiftsService: CashShiftsService) {}

    @ApiOperation({ summary: 'Open a new cash shift' })
    @ApiCreatedResponse({ description: 'Cash shift opened successfully' })
    @ApiConflictResponse({ description: 'An open cash shift already exists for this collaborator or drawer' })
    @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
    @Scopes(Scope.ADMIN_PORTAL, Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS, Scope.MERCHANT_CLOVER)
    @Post()
    openShift(
        @Body() dto: CreateCashShiftDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.cashShiftsService.openShift(dto, user);
    }

    @ApiOperation({ summary: 'List all cash shifts' })
    @ApiOkResponse({ description: 'List of cash shifts retrieved successfully' })
    @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
    @Scopes(Scope.ADMIN_PORTAL, Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS, Scope.MERCHANT_CLOVER)
    @Get()
    findAll(@CurrentUser() user: AuthenticatedUser) {
        return this.cashShiftsService.findAll(user.merchant.id);
    }

    @ApiOperation({ summary: 'Get the active cash shift for the merchant' })
    @ApiOkResponse({ description: 'Active cash shift found successfully' })
    @ApiNotFoundResponse({ description: 'No active cash shift found' })
    @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
    @Scopes(Scope.ADMIN_PORTAL, Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS, Scope.MERCHANT_CLOVER)
    @Get('active')
    findActive(@CurrentUser() user: AuthenticatedUser) {
        return this.cashShiftsService.findActiveShift(user.merchant.id);
    }

    @ApiOperation({ summary: 'Get a cash shift by ID' })
    @ApiOkResponse({ description: 'Cash shift retrieved successfully' })
    @ApiNotFoundResponse({ description: 'Cash shift not found' })
    @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
    @Scopes(Scope.ADMIN_PORTAL, Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS, Scope.MERCHANT_CLOVER)
    @Get(':id')
    findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.cashShiftsService.findOne(id, user.merchant.id);
    }

    @ApiOperation({
        summary: 'Close a cash shift',
        description:
            'The backend calculates the systemAmount (system balance), the difference (declaredAmount - systemAmount), and registers the closing. The closing collaborator is resolved automatically from the authenticated session; the frontend only sends declaredAmount.',
    })
    @ApiOkResponse({ description: 'Cash shift closed successfully with shift summary' })
    @ApiBadRequestResponse({ description: 'The cash shift is not in OPEN status' })
    @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
    @Scopes(Scope.ADMIN_PORTAL, Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS, Scope.MERCHANT_CLOVER)
    @Post(':id/close')
    closeShift(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: CloseCashShiftDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.cashShiftsService.closeShift(id, dto, user);
    }

    @ApiOperation({
        summary: 'Add a manual cash transaction (Income/Expense)',
        description: 'Allows registering cash withdrawals (outflows for suppliers) or cash inflows in the open shift. Outflows cannot exceed the available cash in the till.',
    })
    @ApiCreatedResponse({ description: 'Manual transaction registered successfully' })
    @ApiBadRequestResponse({ description: 'Insufficient funds or cash shift is closed' })
    @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
    @Scopes(Scope.ADMIN_PORTAL, Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS, Scope.MERCHANT_CLOVER)
    @Post(':id/transactions/manual')
    addManualTransaction(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: ManualCashTransactionDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.cashShiftsService.addManualTransaction(id, dto, user.merchant.id);
    }
}
