import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';
import { ProductLittleResponseDto } from '../../../products/dto/product-response.dto';
import { VariantLittleResponseDto } from '../../../variants/dto/variant-response.dto';
import { LocationLittleResponseDto } from '../../locations/dto/location-response.dto';

export class SupplyLittleResponseDto {
  @ApiProperty({ example: 1, description: 'Supply ID' })
  id: number;

  @ApiProperty({ example: 'Tomato paste', description: 'Supply name' })
  name: string;

  @ApiProperty({ example: 'TOMATO_PASTE', description: 'Supply code' })
  code: string;

  @ApiPropertyOptional({ example: 'SKU-12345', description: 'Supply SKU' })
  sku?: string | null;
}

export class ItemResponseDto {
  @ApiProperty({ example: 1, description: 'Item ID' })
  id: number;

  @ApiProperty({ example: 5, description: 'Current quantity' })
  currentQty: number;

  @ApiProperty({
    example: 12.5,
    nullable: true,
    description: 'Weighted average unit cost (WACC/CPP) at this location',
  })
  weightedAverageUnitCost: number | null;

  @ApiProperty({
    example: 10,
    nullable: true,
    description: 'Configured minimum quantity for low-stock alerts',
  })
  minimumQty: number | null;

  @ApiProperty({
    type: () => ProductLittleResponseDto,
    nullable: true,
    description: 'Associated product details',
  })
  product: ProductLittleResponseDto | null;

  @ApiProperty({
    type: () => VariantLittleResponseDto,
    nullable: true,
    description: 'Associated variant details',
  })
  variant: VariantLittleResponseDto | null;

  @ApiProperty({
    type: () => SupplyLittleResponseDto,
    nullable: true,
    description: 'Associated supply (raw material) details',
  })
  supply: SupplyLittleResponseDto | null;

  @ApiProperty({
    type: () => LocationLittleResponseDto,
    description: 'Associated stock location details',
  })
  location: LocationLittleResponseDto | null;
}

export class ItemLittleResponseDto {
  @ApiProperty({ example: 1, description: 'Item ID' })
  id: number;

  @ApiProperty({ example: 5, description: 'Current quantity' })
  currentQty: number;
}

export class OneItemResponse extends SuccessResponse {
  @ApiProperty()
  data: ItemResponseDto;
}
