//src/restaurant-operations/dining-system/floor-plan/dto/create-floor-plan.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateFloorPlanDto {
  @ApiProperty({ example: 1, description: 'Identifier of the Merchant' })
  @IsInt()
  @IsNotEmpty()
  merchant: number;

  @ApiProperty({
    example: 'Main Floor Plan',
    description: 'Name of the Floor Plan',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 500,
    description: 'Width of the floor plan in pixels',
  })
  @IsInt()
  @IsNotEmpty()
  width: number;

  @ApiProperty({
    example: 300,
    description: 'Height of the floor plan in pixels',
  })
  @IsInt()
  @IsNotEmpty()
  height: number;

  // Contorno de la sala como JSON serializado (píxeles del lienzo). Es opcional porque los planos
  // rectangulares no lo necesitan: omitirlo (o mandar null) equivale a "rectángulo width × height".
  // El tope de 20 000 caracteres corta payloads absurdos; un polígono razonable ocupa cientos de bytes.
  @ApiProperty({
    required: false,
    nullable: true,
    example: '[{"x":0,"y":0},{"x":800,"y":0},{"x":800,"y":600},{"x":0,"y":600}]',
    description:
      'Room outline polygon serialized as JSON, in canvas pixels. Omit or send null for a plain rectangle.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  outline?: string | null;

  // 'active' | 'draft' | 'archived' es el vocabulario del backoffice; 'inactive' y 'deleted'
  // se mantienen porque otros clientes (POS, portal) siguen enviándolos.
  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive', 'draft', 'archived', 'deleted'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['active', 'inactive', 'draft', 'archived', 'deleted'])
  status: string;
}
