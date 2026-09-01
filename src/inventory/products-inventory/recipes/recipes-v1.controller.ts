import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { FeatureAccessGuard } from 'src/auth/guards/feature-access.guard';
import { RequireFeature } from 'src/auth/decorators/require-feature.decorator';
import { SUBSCRIPTION_FEATURE_IDS } from 'src/common/subscription/subscription-feature-ids';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/platform-saas/users/constants/role.enum';
import { Scope } from 'src/platform-saas/users/constants/scope.enum';
import { Scopes } from 'src/auth/decorators/scopes.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { RecipesService } from './recipes.service';
import { CreateRecipeV1Dto } from './dto/create-recipe-v1.dto';
import { UpdateRecipeV1Dto } from './dto/update-recipe-v1.dto';
import { ProductRecipe } from './entities/product-recipe.entity';

@ApiTags('Recipes V1')
@ApiBearerAuth()
@Controller('v1/recipes')
@RequireFeature(SUBSCRIPTION_FEATURE_IDS.PRODUCT_MANAGEMENT)
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
export class RecipesV1Controller {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({
    summary: 'Get all recipes for the authenticated merchant',
  })
  @ApiOkResponse({ type: ProductRecipe, isArray: true })
  async findAllForMerchant(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductRecipe[]> {
    const merchantId = user.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return this.recipesService.findAllForMerchant(merchantId);
  }

  @Post()

  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({
    summary: 'Create or assign a recipe to a product/variant',
  })
  @ApiBody({ type: CreateRecipeV1Dto })
  @ApiCreatedResponse({ type: ProductRecipe })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecipeV1Dto,
  ): Promise<ProductRecipe> {
    const merchantId = user.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return this.recipesService.createRecipeV1(merchantId, dto);
  }

  @Get('product/:productId')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({
    summary: 'Get recipe details for a specific product',
  })
  @ApiParam({ name: 'productId', type: Number, description: 'Finished product ID' })
  @ApiOkResponse({ type: ProductRecipe, isArray: true })
  async findForProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<ProductRecipe[]> {
    const merchantId = user.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return this.recipesService.findRecipeForProduct(merchantId, productId);
  }

  @Put(':recipeId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({
    summary: 'Update recipe ingredients or quantities',
  })
  @ApiParam({ name: 'recipeId', type: Number, description: 'Recipe ID' })
  @ApiBody({ type: UpdateRecipeV1Dto })
  @ApiOkResponse({ type: ProductRecipe })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recipeId', ParseIntPipe) recipeId: number,
    @Body() dto: UpdateRecipeV1Dto,
  ): Promise<ProductRecipe> {
    const merchantId = user.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');
    return this.recipesService.updateRecipeV1(merchantId, recipeId, dto);
  }

  @Delete(':recipeId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({
    summary: 'Remove a recipe or an ingredient line item',
  })
  @ApiParam({ name: 'recipeId', type: Number, description: 'Recipe ID' })
  @ApiQuery({
    name: 'lineItemId',
    type: Number,
    required: false,
    description: 'Ingredient line item ID to delete (if omitted, deletes the entire recipe)',
  })
  @ApiNoContentResponse({ description: 'Recipe or line item deleted successfully' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('recipeId', ParseIntPipe) recipeId: number,
    @Query('lineItemId') lineItemId?: number,
  ): Promise<void> {
    const merchantId = user.merchant?.id;
    if (!merchantId) throw new BadRequestException('User must have a merchant');

    let parsedLineItemId: number | undefined;
    if (lineItemId !== undefined && lineItemId !== null) {
      parsedLineItemId = Number(lineItemId);
      if (Number.isNaN(parsedLineItemId)) {
        throw new BadRequestException('Invalid lineItemId');
      }
    }

    await this.recipesService.removeRecipeOrLine(
      merchantId,
      recipeId,
      parsedLineItemId,
    );
  }
}
