import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum RawMaterialStatusFilter {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ALL = 'all',
}

export class FilterRawMaterialDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 1, description: 'Filter by category ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  category_id?: number;

  @ApiPropertyOptional({
    enum: RawMaterialStatusFilter,
    default: RawMaterialStatusFilter.ALL,
    description: 'Filter by status (active, inactive, all)',
  })
  @IsOptional()
  @IsEnum(RawMaterialStatusFilter)
  status?: RawMaterialStatusFilter = RawMaterialStatusFilter.ALL;

  @ApiPropertyOptional({
    example: 'Tomato',
    description: 'Search string by name, code or SKU',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
