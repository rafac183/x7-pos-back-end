import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRawMaterialCategoryDto {
  @ApiProperty({ example: 'Dairy', description: 'Raw material category name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: 'Milk, cheese, butter and other dairy products',
    description: 'Raw material category description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Active status',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
