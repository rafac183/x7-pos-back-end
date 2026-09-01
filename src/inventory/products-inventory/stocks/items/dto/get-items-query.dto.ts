import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetItemsQueryDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for pagination (minimum 1)',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Number of items per page (1-100)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'Product A',
    description: 'Filter items by product name',
  })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({
    example: 'Variant A',
    description: 'Filter items by variant name',
  })
  @IsOptional()
  @IsString()
  variantName?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filter by location ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  locationId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filter by supply ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  supplyId?: number;
}
