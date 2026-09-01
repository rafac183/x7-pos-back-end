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
import { RawMaterialCategoriesService } from './raw-material-categories.service';
import { CreateRawMaterialCategoryDto } from './dto/create-raw-material-category.dto';
import { UpdateRawMaterialCategoryDto } from './dto/update-raw-material-category.dto';
import { FilterRawMaterialCategoryDto } from './dto/filter-raw-material-category.dto';

@ApiTags('Raw Material Categories')
@ApiBearerAuth()
@Controller('v1/raw-material-categories')
@RequireFeature(SUBSCRIPTION_FEATURE_IDS.PRODUCT_MANAGEMENT)
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
export class RawMaterialCategoriesController {
  constructor(
    private readonly categoriesService: RawMaterialCategoriesService,
  ) {}

  @Post()
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Create a new raw material category' })
  async create(
    @Body() dto: CreateRawMaterialCategoryDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.categoriesService.create(merchantId, dto);
  }

  @Get()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({
    summary: 'List all raw material categories with status/name filtering',
  })
  async findAll(
    @Query() filter: FilterRawMaterialCategoryDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.categoriesService.findAll(merchantId, filter);
  }

  @Get(':id')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({
    summary: 'Retrieve details for a specific raw material category',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.categoriesService.findOne(merchantId, id);
  }

  @Put(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Update raw material category details (PUT)' })
  async updatePut(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRawMaterialCategoryDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.categoriesService.update(merchantId, id, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Update raw material category details (PATCH)' })
  async updatePatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRawMaterialCategoryDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.categoriesService.update(merchantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(Scope.MERCHANT_WEB, Scope.MERCHANT_ANDROID, Scope.MERCHANT_IOS)
  @ApiOperation({ summary: 'Soft-delete or archive a raw material category' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    const merchantId = req.user?.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return await this.categoriesService.remove(merchantId, id);
  }
}
