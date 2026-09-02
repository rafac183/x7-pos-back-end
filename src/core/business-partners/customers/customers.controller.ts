// src/customers/customers.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
  ForbiddenException
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { FeatureAccessGuard } from 'src/auth/guards/feature-access.guard';
import { RequireFeature } from 'src/auth/decorators/require-feature.decorator';
import { SUBSCRIPTION_FEATURE_IDS } from 'src/common/subscription/subscription-feature-ids';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiExtraModels,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dtos/create-customer.dto';
import { UpdateCustomerDto } from './dtos/update-customer.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthenticatedUser } from 'src/auth/interfaces/authenticated-user.interface';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Customer } from './entities/customer.entity';
import { ErrorResponse } from 'src/common/dtos/error-response.dto';

@ApiTags('Customers')
@ApiExtraModels(ErrorResponse)
@ApiBearerAuth()
@Controller('customers')
@RequireFeature(SUBSCRIPTION_FEATURE_IDS.CUSTOMERS)
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

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

  /**
   * Usuario autenticado completo. Este servicio recibe el usuario, no sólo su comercio,
   * así que hace falta el objeto entero — y sigue viniendo de `req.user`.
   */
  private userOf(
    req: ExpressRequest & { user?: AuthenticatedUser },
  ): AuthenticatedUser {
    const user = req.user;
    if (!user?.merchant?.id) {
      throw new ForbiddenException(
        'User must be associated with a merchant for this operation',
      );
    }
    return user;
  }


  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiResponse({
    status: 201,
    description: 'Customer created successfully',
    type: Customer,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 400,
        message: ['name must be longer than or equal to 2 characters'],
        error: 'Bad Request',
      },
    },
  })
  // 'portal_admin', 'portal_user', 'merchant_admin', 'merchant_user'
  @ApiBody({ type: CreateCustomerDto })
  @Roles('portal_admin', 'merchant_admin', 'customer_admin')
  create(@Body() dto: CreateCustomerDto, @Request() req: ExpressRequest & { user?: AuthenticatedUser }) {
    return this.customersService.create(dto, this.userOf(req));
  }

  @Get()
  @ApiOperation({ summary: 'Get all customers' })
  @ApiResponse({
    status: 200,
    description: 'List of customers',
    type: [Customer],
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    },
  })
  @Roles(
    'portal_admin',
    'merchant_admin',
    'customer_admin',
    'portal_user',
    'merchant_user',
    'customer_user',
  )
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a customer by ID' })
  @ApiParam({ name: 'id', type: Number, description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Customer found', type: Customer })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 404,
        message: 'Customer not found',
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid ID',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 400,
        message: 'Validation failed (numeric string is expected)',
        error: 'Bad Request',
      },
    },
  })
  @Roles(
    'portal_admin',
    'merchant_admin',
    'customer_admin',
    'portal_user',
    'merchant_user',
    'customer_user',
  )
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    return this.customersService.findOne(id, this.userOf(req));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a customer' })
  @ApiParam({ name: 'id', type: Number, description: 'Customer ID' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiResponse({ status: 200, description: 'Company updated', type: Customer })
  @ApiResponse({
    status: 404,
    description: 'Company not found',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 404,
        message: 'Company not found',
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 404,
        message: 'Customer not found',
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 400,
        message: ['name must be longer than or equal to 2 characters'],
        error: 'Bad Request',
      },
    },
  })
  @Roles('portal_admin', 'merchant_admin', 'customer_admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    return this.customersService.update(id, dto, this.userOf(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a customer' })
  @ApiParam({ name: 'id', type: Number, description: 'Customer ID' })
  @ApiResponse({ status: 200, description: 'Customer deleted' })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 404,
        message: 'Customer not found',
        error: 'Not Found',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid ID',
    type: ErrorResponse,
    schema: {
      example: {
        statusCode: 400,
        message: 'Validation failed (numeric string is expected)',
        error: 'Bad Request',
      },
    },
  })
  @Roles('portal_admin', 'merchant_admin', 'customer_admin')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: ExpressRequest & { user?: AuthenticatedUser },
  ) {
    return this.customersService.remove(id, this.userOf(req));
  }
}
