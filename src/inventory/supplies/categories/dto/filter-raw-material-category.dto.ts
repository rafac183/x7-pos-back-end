import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum CategoryStatusFilter {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ALL = 'all',
}

export class FilterRawMaterialCategoryDto {
  @ApiPropertyOptional({
    enum: CategoryStatusFilter,
    default: CategoryStatusFilter.ALL,
    description: 'Filter categories by status (active, inactive, all)',
  })
  @IsOptional()
  @IsEnum(CategoryStatusFilter)
  status?: CategoryStatusFilter = CategoryStatusFilter.ALL;

  @ApiPropertyOptional({
    example: 'Meat',
    description: 'Search category by name',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
