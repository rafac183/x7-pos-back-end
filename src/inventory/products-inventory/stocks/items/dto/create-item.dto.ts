import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

export class CreateItemDto {
  @ApiPropertyOptional({ example: 1, description: 'Associated product ID' })
  @IsOptional()
  @IsInt()
  productId?: number;

  @ApiProperty({
    example: 1,
    description: 'Associated stock location ID',
  })
  @IsNotEmpty()
  @IsInt()
  locationId: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Associated variant ID',
  })
  @IsOptional()
  @IsInt()
  variantId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Associated supply (raw material) ID',
  })
  @IsOptional()
  @IsInt()
  supplyId?: number;

  @ApiProperty({ example: 10, description: 'Current item quantity' })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  currentQty: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Minimum quantity for low-stock alerts (omit to disable)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumQty?: number;
}
