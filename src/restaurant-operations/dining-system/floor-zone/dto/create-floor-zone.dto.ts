//src/restaurant-operations/dining-system/floor-zone/dto/create-floor-zone.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFloorZoneDto {
  @ApiProperty({ example: 1, description: 'Identifier of the Merchant' })
  @IsInt()
  @IsNotEmpty()
  merchant: number;

  @ApiProperty({
    example: 'Main Dining Area',
    description: 'Name of the Floor Zone',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Blue',
    description: 'Color associated with the Floor Zone for UI representation',
  })
  @IsString()
  @IsNotEmpty()
  color: string;

  // Polígono de la zona serializado; opcional para no romper a los clientes existentes.
  @ApiPropertyOptional({
    example: '[{"x":0,"y":0},{"x":400,"y":0},{"x":400,"y":300},{"x":0,"y":300}]',
    description: 'Zone area polygon as JSON, in canvas pixels; null = no drawn area',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  area?: string | null;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Floor Plan related (if applicable)',
  })
  @IsInt()
  @IsNotEmpty()
  floorPlan: number;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive'] })
  @IsString()
  @IsNotEmpty()
  // 'draft'/'archived' son el vocabulario de la UI; 'inactive'/'deleted' se conservan por
  // compatibilidad con clientes anteriores.
  @IsIn(['active', 'inactive', 'draft', 'archived', 'deleted'])
  status: string;
}
