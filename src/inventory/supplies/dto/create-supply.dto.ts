import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  IsBoolean,
} from 'class-validator';
import { SupplyUnit } from '../constants/supply-unit.enum';

export class CreateSupplyDto {
  @ApiPropertyOptional({ example: 'TOMATO_PASTE' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @ApiPropertyOptional({ example: 'SKU-10023' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @ApiProperty({ example: 'Tomato paste' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 1, description: 'Category ID' })
  @IsOptional()
  @IsInt()
  category_id?: number;

  @ApiPropertyOptional({ enum: SupplyUnit, example: SupplyUnit.GRAM })
  @IsOptional()
  @IsEnum(SupplyUnit)
  unit?: SupplyUnit;

  @ApiPropertyOptional({ example: 'kg', description: 'Purchase unit (e.g. kg, liters, box)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  purchase_unit?: string;

  @ApiPropertyOptional({ example: 'g', description: 'Consumption unit (e.g. grams, ml, units)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  consumption_unit?: string;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Conversion factor between purchase unit and consumption unit',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  conversion_factor?: number;

  @ApiPropertyOptional({ example: 20, description: 'Minimum stock threshold' })
  @IsOptional()
  @IsNumber()
  minimumQty?: number;

  @ApiPropertyOptional({
    example: 12.5,
    description: 'Cost per unit (manually set or dynamic initial cost)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_per_unit?: number;

  @ApiPropertyOptional({ example: 'Canned tomato paste', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true, default: true, description: 'Active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
