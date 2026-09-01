import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
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
import { ItemsService } from '../products-inventory/stocks/items/items.service';
import { LocationsService } from '../products-inventory/stocks/locations/locations.service';
import { CreateLocationDto } from '../products-inventory/stocks/locations/dto/create-location.dto';
import { UpdateLocationDto } from '../products-inventory/stocks/locations/dto/update-location.dto';
import { GetLocationsQueryDto } from '../products-inventory/stocks/locations/dto/get-locations-query.dto';
import { GetItemsQueryDto } from '../products-inventory/stocks/items/dto/get-items-query.dto';
import { MovementsService } from '../products-inventory/stocks/movements/movements.service';
import { CreateMovementDto } from '../products-inventory/stocks/movements/dto/create-movement.dto';
import { GetMovementsQueryDto } from '../products-inventory/stocks/movements/dto/get-movements-query.dto';

@ApiTags('Raw Material Stock')
@ApiBearerAuth()
@Controller('v1/raw-material-stock')
@RequireFeature(SUBSCRIPTION_FEATURE_IDS.STOCK_AND_STOCK_MOVEMENTS)
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
export class RawMaterialStockController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly locationsService: LocationsService,
    private readonly movementsService: MovementsService,
  ) {}

  @Get('items')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Get stock balance per raw material and location' })
  @ApiQuery({ name: 'locationId', required: false, type: Number })
  @ApiQuery({ name: 'supplyId', required: false, type: Number })
  async getStockItems(
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
    @Query() query: GetItemsQueryDto & { locationId?: number; supplyId?: number },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');

    return await this.itemsService.findAll({
      ...query,
    } as any, merchantId);
  }

  @Post('locations')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Create storage location' })
  async createLocation(
    @Body() dto: CreateLocationDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.locationsService.create(merchantId, dto);
  }

  @Get('locations')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'List all storage locations' })
  async listLocations(
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
    @Query() query: GetLocationsQueryDto,
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.locationsService.findAll(query, merchantId);
  }

  @Get('locations/:id')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Get details for a specific storage location' })
  async getOneLocation(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.locationsService.findOne(id, merchantId);
  }

  @Patch('locations/:id')
  @Put('locations/:id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Update storage location' })
  async updateLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocationDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.locationsService.update(id, merchantId, dto);
  }

  @Delete('locations/:id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Soft-delete or deactivate a storage location' })
  async deleteLocation(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.locationsService.remove(id, merchantId);
  }

  @Post('movements')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Record a manual stock entry, adjustment, or waste log' })
  async recordMovement(
    @Body() dto: CreateMovementDto & {
      sourceLocationId?: number;
      destinationLocationId?: number;
      createdBy?: string;
      movementType?: string;
    },
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');

    // Asignar el usuario creador de forma predeterminada
    const userName = req.user?.email || 'Inventory Clerk';
    dto.createdBy = dto.createdBy || userName;

    return await this.movementsService.create(merchantId, dto);
  }

  @Post('movements/deplete-from-order')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Internal/Service endpoint to process recipe-driven stock depletion from sales orders' })
  async depleteFromOrder(
    @Body() body: { orderId: number },
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    if (!body.orderId) throw new BadRequestException('Must provide orderId');

    return await this.movementsService.depleteFromOrder(merchantId, body.orderId);
  }

  @Get('movements')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Audit history of stock movements with date/type filters' })
  async auditHistory(
    @Query() query: GetMovementsQueryDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');

    return await this.movementsService.findAll(query, merchantId);
  }
}
