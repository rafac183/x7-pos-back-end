import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MovementsStatus } from '../constants/movements-status';

export class CreateMovementDto {
  @ApiProperty({
    example: 1,
    description: 'Stock Item ID associated with the movement',
  })
  @IsNotEmpty()
  @IsInt()
  stockItemId: number;

  @ApiProperty({ example: 10, description: 'Quantity of the movement' })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty({
    example: MovementsStatus.IN,
    description: 'Type of movement',
    enum: MovementsStatus,
    default: MovementsStatus.IN,
  })
  @IsNotEmpty()
  @IsEnum(MovementsStatus)
  type?: MovementsStatus;

  @ApiProperty({
    example: 'REF-001',
    description: 'Movement reference (optional)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({
    example: 'Reason 1',
    description: 'Reason for the movement (optional)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 1, description: 'Source location ID' })
  @IsOptional()
  @IsInt()
  sourceLocationId?: number;

  @ApiPropertyOptional({ example: 2, description: 'Destination location ID' })
  @IsOptional()
  @IsInt()
  destinationLocationId?: number;

  @ApiPropertyOptional({ example: 'Admin', description: 'User who created the movement' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({ example: 'TRANSFER', description: 'Raw material stock movement type' })
  @IsOptional()
  @IsString()
  movementType?: string;

  @ApiPropertyOptional({ example: 12.50, description: 'Unit cost of material' })
  @IsOptional()
  unitCost?: number | string;

  @ApiPropertyOptional({ example: 5, description: 'Raw material supply ID' })
  @IsOptional()
  @IsInt()
  supplyId?: number;
}
