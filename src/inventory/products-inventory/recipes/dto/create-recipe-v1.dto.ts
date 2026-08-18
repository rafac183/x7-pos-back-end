import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecipeLineV1Dto {
  @ApiProperty({ example: 1, description: 'Raw Material (Supply) ID' })
  @IsInt()
  @Min(1)
  raw_material_id: number;

  @ApiProperty({ example: 150.5, description: 'Quantity required in consumption units' })
  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @ApiProperty({ example: 'grams', description: 'Unit of measure (in consumption units)' })
  @IsString()
  @IsNotEmpty()
  unit_of_measure: string;

  @ApiPropertyOptional({ example: 150.5, description: 'Quantity per sold unit (optional)' })
  @IsOptional()
  @IsNumber()
  quantity_per_sold_unit?: number;

  @ApiPropertyOptional({ example: 1.25, description: 'Cost contribution (optional)' })
  @IsOptional()
  @IsNumber()
  cost_contribution?: number;
}

export class CreateRecipeV1Dto {
  @ApiProperty({ example: 1, description: 'Product ID to assign the recipe to' })
  @IsInt()
  @Min(1)
  productId: number;

  @ApiPropertyOptional({ example: 2, description: 'Specific variant ID (optional)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  variantId?: number;

  @ApiPropertyOptional({ example: 'Classic Burger Recipe', description: 'Recipe formula name (optional)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 1, description: 'Yield quantity / portions (optional)' })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  yieldQuantity?: number;

  @ApiPropertyOptional({ example: true, description: 'Active status (optional)' })
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 5.50, description: 'Total theoretical cost (optional)' })
  @IsOptional()
  @IsNumber()
  totalTheoreticalCost?: number;

  @ApiProperty({ type: [RecipeLineV1Dto], description: 'Recipe ingredient lines' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RecipeLineV1Dto)
  lines: RecipeLineV1Dto[];
}
