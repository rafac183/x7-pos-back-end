import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { RecipeLineV1Dto } from './create-recipe-v1.dto';

export class UpdateRecipeV1Dto {
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

