import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  ParseIntPipe,
  UseGuards,
  Request,
  Query,
  ForbiddenException
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FeatureAccessGuard } from 'src/auth/guards/feature-access.guard';
import { RequireFeature } from 'src/auth/decorators/require-feature.decorator';
import { SUBSCRIPTION_FEATURE_IDS } from 'src/common/subscription/subscription-feature-ids';

import { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import { CollaboratorTimeEntriesService } from './collaborator-time-entries.service';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { GetTimeEntryQueryDto } from './dto/get-time-entry-query.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { OneTimeEntryResponseDto } from './dto/time-entry-response.dto';
import { PaginatedTimeEntriesResponseDto } from './dto/paginated-time-entries-response.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';
import { Scopes } from 'src/auth/decorators/scopes.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiTags('Collaborator time entries')
@ApiBearerAuth()
@Controller('collaborator-time-entries')
@RequireFeature(SUBSCRIPTION_FEATURE_IDS.COLLABORATOR_TIME_ENTRIES)
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
export class CollaboratorTimeEntriesController {
  constructor(
    private readonly collaboratorTimeEntriesService: CollaboratorTimeEntriesService,
  ) {}

  /**
   * Comercio del usuario autenticado.
   *
   * Passport cuelga el usuario de `req.user`. Leerlo como `req.merchant?.id` —tipando el
   * request como AuthenticatedUser, lo que hacía pasar el error por delante del compilador—
   * devolvía siempre undefined y el servicio respondía 403 a todas las llamadas.
   */
  private merchantIdOf(
    req: ExpressRequest & { user?: AuthenticatedUser },
  ): number {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) {
      throw new ForbiddenException(
        'User must be associated with a merchant for this operation',
      );
    }
    return merchantId;
  }


  @Post()
  @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({ summary: 'Create time entry' })
  @ApiCreatedResponse({
    description: 'Time entry created',
    type: OneTimeEntryResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiNotFoundResponse({
    description: 'Company, Merchant, Collaborator or Shift not found',
  })
  async create(
    @Body() dto: CreateTimeEntryDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ): Promise<OneTimeEntryResponseDto> {
    const merchantId = this.merchantIdOf(req);
    return this.collaboratorTimeEntriesService.create(dto, merchantId);
  }

  @Get()
  @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({ summary: 'Get all time entries (paginated)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'company_id', required: false })
  @ApiQuery({ name: 'merchant_id', required: false })
  @ApiQuery({ name: 'collaborator_id', required: false })
  @ApiQuery({ name: 'shift_id', required: false })
  @ApiQuery({ name: 'approved', required: false })
  @ApiQuery({ name: 'from_date', required: false })
  @ApiQuery({ name: 'to_date', required: false })
  @ApiOkResponse({
    description: 'Paginated time entries',
    type: PaginatedTimeEntriesResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async findAll(
    @Query() query: GetTimeEntryQueryDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ): Promise<PaginatedTimeEntriesResponseDto> {
    const merchantId = this.merchantIdOf(req);
    return this.collaboratorTimeEntriesService.findAll(query, merchantId);
  }

  @Get(':id/revisions')
  @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN)
  @ApiOperation({
    summary: 'Correction history for one time entry',
    description:
      'Every supervisor correction, newest first, with the punch values before and after. Insert-only: nothing rewrites this history, which is what makes it usable in a payroll dispute.',
  })
  @ApiParam({ name: 'id', type: Number, description: 'Time entry ID', example: 1 })
  async revisions(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    return this.collaboratorTimeEntriesService.revisions(
      id,
      this.merchantIdOf(req),
    );
  }

  @Get(':id')
  @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({ summary: 'Get time entry by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description: 'Time entry found',
    type: OneTimeEntryResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Time entry not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ): Promise<OneTimeEntryResponseDto> {
    const merchantId = this.merchantIdOf(req);
    return this.collaboratorTimeEntriesService.findOne(id, merchantId);
  }

  @Put(':id')
  @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({ summary: 'Update time entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description: 'Time entry updated',
    type: OneTimeEntryResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  @ApiNotFoundResponse({ description: 'Time entry not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTimeEntryDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ): Promise<OneTimeEntryResponseDto> {
    const merchantId = this.merchantIdOf(req);
    // El id del supervisor viaja al servicio: es la firma de la corrección en el histórico.
    return this.collaboratorTimeEntriesService.update(
      id,
      dto,
      merchantId,
      req.user?.id,
    );
  }

  @Delete(':id')
  @Roles(UserRole.PORTAL_ADMIN, UserRole.MERCHANT_ADMIN)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({ summary: 'Delete time entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description: 'Time entry deleted',
    type: OneTimeEntryResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Time entry not found' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ): Promise<OneTimeEntryResponseDto> {
    const merchantId = this.merchantIdOf(req);
    return this.collaboratorTimeEntriesService.remove(id, merchantId);
  }
}
