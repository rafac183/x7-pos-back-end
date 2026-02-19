import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoyaltyRewardsRedemtionsService } from './loyalty-rewards-redemtions.service';
import { CreateLoyaltyRewardsRedemtionDto } from './dto/create-loyalty-rewards-redemtion.dto';
import { UpdateLoyaltyRewardsRedemtionDto } from './dto/update-loyalty-rewards-redemtion.dto';
import { GetLoyaltyRewardsRedemtionsQueryDto } from './dto/get-loyalty-rewards-redemtions-query.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from 'src/users/constants/role.enum';
import { Scope } from 'src/users/constants/scope.enum';
import { Scopes } from 'src/auth/decorators/scopes.decorator';
import { ErrorResponse } from 'src/common/dtos/error-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { AllPaginatedLoyaltyRewardsRedemtionDto } from './dto/all-paginated-loyalty-rewards-redemtion.dto';
import { OneLoyaltyRewardsRedemtionResponse } from './dto/loyalty-rewards-redemtion-response.dto';

@ApiExtraModels(ErrorResponse)
@ApiBearerAuth()
@ApiTags('Loyalty Rewards Redemptions')
@Controller('loyalty-rewards-redemtions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoyaltyRewardsRedemtionsController {
  constructor(
    private readonly loyaltyRewardsRedemtionsService: LoyaltyRewardsRedemtionsService,
  ) { }

  @Post()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({ summary: 'Create a new Loyalty Rewards Redemption' })
  @ApiCreatedResponse({
    description: 'Loyalty Rewards Redemption created successfully',
    type: OneLoyaltyRewardsRedemtionResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 400,
        message: ['loyalty_customer_id must be an integer', 'reward_id must be an integer'],
        error: 'Bad Request',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponse,
  })
  @ApiConflictResponse({
    description: 'Redemption conflict',
    type: ErrorResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponse })
  @ApiBody({ type: CreateLoyaltyRewardsRedemtionDto })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createLoyaltyRewardsRedemtionDto: CreateLoyaltyRewardsRedemtionDto,
  ): Promise<OneLoyaltyRewardsRedemtionResponse> {
    const merchantId = user.merchant.id;
    return this.loyaltyRewardsRedemtionsService.create(merchantId, createLoyaltyRewardsRedemtionDto);
  }

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
    summary: 'Get all loyalty rewards redemptions with pagination and filters',
    description:
      'Retrieves a paginated list of loyalty rewards redemptions with optional filters.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination (minimum 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page (1-100)',
    example: 10,
  })
  @ApiQuery({
    name: 'min_redeemed_points',
    required: false,
    type: Number,
    description: 'Filter redemptions by minimum points',
    example: 100,
  })
  @ApiQuery({
    name: 'max_redeemed_points',
    required: false,
    type: Number,
    description: 'Filter redemptions by maximum points',
    example: 500,
  })
  @ApiOkResponse({
    description: 'Paginated list of loyalty rewards redemptions retrieved successfully',
    type: AllPaginatedLoyaltyRewardsRedemtionDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized - Invalid or missing authentication token',
    type: ErrorResponse,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: ErrorResponse,
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetLoyaltyRewardsRedemtionsQueryDto,
  ): Promise<AllPaginatedLoyaltyRewardsRedemtionDto> {
    const merchantId = user.merchant.id;
    return this.loyaltyRewardsRedemtionsService.findAll(query, merchantId);
  }

  @Get(':id')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_USER)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({ summary: 'Get a Loyalty Rewards Redemption by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Redemption ID' })
  @ApiOkResponse({
    description: 'Loyalty Rewards Redemption found',
    type: OneLoyaltyRewardsRedemtionResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponse })
  @ApiNotFoundResponse({
    description: 'Loyalty Rewards Redemption not found',
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid ID',
    type: ErrorResponse,
  })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OneLoyaltyRewardsRedemtionResponse> {
    const merchantId = user.merchant.id;
    return this.loyaltyRewardsRedemtionsService.findOne(id, merchantId);
  }

  @Patch(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({ summary: 'Update a Loyalty Rewards Redemption' })
  @ApiParam({ name: 'id', type: Number, description: 'Redemption ID' })
  @ApiBody({ type: UpdateLoyaltyRewardsRedemtionDto })
  @ApiOkResponse({
    description: 'Loyalty Rewards Redemption updated successfully',
    type: OneLoyaltyRewardsRedemtionResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponse })
  @ApiNotFoundResponse({
    description: 'Loyalty Rewards Redemption not found',
    type: ErrorResponse,
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLoyaltyRewardsRedemtionDto: UpdateLoyaltyRewardsRedemtionDto,
  ): Promise<OneLoyaltyRewardsRedemtionResponse> {
    const merchantId = user.merchant.id;
    return this.loyaltyRewardsRedemtionsService.update(
      id,
      merchantId,
      updateLoyaltyRewardsRedemtionDto,
    );
  }

  @Delete(':id')
  @Roles(UserRole.MERCHANT_ADMIN)
  @Scopes(
    Scope.ADMIN_PORTAL,
    Scope.MERCHANT_WEB,
    Scope.MERCHANT_ANDROID,
    Scope.MERCHANT_IOS,
    Scope.MERCHANT_CLOVER,
  )
  @ApiOperation({ summary: 'Delete a Loyalty Rewards Redemption' })
  @ApiParam({ name: 'id', type: Number, description: 'Redemption ID' })
  @ApiOkResponse({
    description: 'Loyalty Rewards Redemption deleted successfully',
    type: OneLoyaltyRewardsRedemtionResponse,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ErrorResponse })
  @ApiNotFoundResponse({
    description: 'Loyalty Rewards Redemption not found',
    type: ErrorResponse,
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<OneLoyaltyRewardsRedemtionResponse> {
    const merchantId = user.merchant.id;
    return this.loyaltyRewardsRedemtionsService.remove(id, merchantId);
  }
}
