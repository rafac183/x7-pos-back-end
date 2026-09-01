import {
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
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { SuppliesService } from './supplies.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { SetSupplySuppliersDto } from './dto/set-supply-suppliers.dto';
import { FilterRawMaterialDto } from './dto/filter-raw-material.dto';

@ApiTags('Supplies / Raw Materials')
@ApiBearerAuth()
@Controller(['v1/inventory/raw-materials', 'v1/raw-materials', 'supplies'])
@RequireFeature(SUBSCRIPTION_FEATURE_IDS.PRODUCT_MANAGEMENT)
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Post()
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Create a new raw material (Supply)' })
  async create(
    @Body() dto: CreateSupplyDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.suppliesService.create(merchantId, dto);
  }

  @Get()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({
    summary: 'Paginated list of raw materials with filtering (by category/status)',
  })
  async findAll(
    @Query() filter: FilterRawMaterialDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.suppliesService.findAllPaginated(merchantId, filter);
  }

  @Get(':id')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Fetch single raw material details' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.suppliesService.findOne(merchantId, id);
  }

  @Put(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Update raw material metadata/units (PUT)' })
  async updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplyDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.suppliesService.update(merchantId, id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Update raw material metadata/units (PATCH)' })
  async updatePatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupplyDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.suppliesService.update(merchantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Soft-delete a raw material' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.suppliesService.remove(merchantId, id);
  }

  @Post(':id/suppliers')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Replace raw material suppliers (company-scoped)' })
  async setSuppliers(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetSupplySuppliersDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.suppliesService.setSuppliers(
      merchantId,
      id,
      dto.supplierIds,
    );
  }

  @Get(':id/usage')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Check if raw material is used in active recipes or stock movements' })
  async checkUsage(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.suppliesService.checkUsage(merchantId, id);
  }
}
