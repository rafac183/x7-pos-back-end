import {
  IsString,
  IsNumber,
  IsPositive,
  IsOptional,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  TABLE_SHAPES,
  TABLE_MIN_SIZE_PX,
  TABLE_MAX_SIZE_PX,
} from '../../constants/table-shape.constants';

export class UpdateTableDto {
  @ApiPropertyOptional({
    example: 'A1',
    description: 'Table number or identifier',
  })
  @IsString()
  @IsOptional()
  number?: string;

  @ApiPropertyOptional({
    example: 4,
    description: 'Seating capacity (minimum 1 person)',
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({ example: 'available', description: 'Table status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    example: 'Near window',
    description: 'Location description',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    example: 90,
    description: 'Rotation for the table in degrees (0-360)',
  })
  @IsNumber()
  @Min(0)
  @Max(360)
  @IsOptional()
  rotation?: number;

  @ApiPropertyOptional({
    example: 'Circle',
    description:
      'Shape of the table (Circle, Square, Rectangle, Oval, Booth, Counter)',
  })
  @IsString()
  @IsOptional()
  @IsIn([...TABLE_SHAPES])
  shape?: string;

  // null devuelve la mesa al tamaño por defecto de su forma, así que se acepta explícitamente.
  @ApiPropertyOptional({
    example: 120,
    nullable: true,
    description: 'Custom table width in canvas pixels; null resets to the shape default',
  })
  @IsOptional()
  @IsNumber()
  @Min(TABLE_MIN_SIZE_PX)
  @Max(TABLE_MAX_SIZE_PX)
  width?: number | null;

  @ApiPropertyOptional({
    example: 70,
    nullable: true,
    description: 'Custom table height in canvas pixels; null resets to the shape default',
  })
  @IsOptional()
  @IsNumber()
  @Min(TABLE_MIN_SIZE_PX)
  @Max(TABLE_MAX_SIZE_PX)
  height?: number | null;

  @ApiPropertyOptional({
    example: 100,
    description: 'X coordinate for the table position on the floor plan',
  })
  @IsNumber()
  @IsOptional()
  pos_x?: number;

  @ApiPropertyOptional({
    example: 100,
    description: 'Y coordinate for the table position on the floor plan',
  })
  @IsNumber()
  @IsOptional()
  pos_y?: number;

  @ApiPropertyOptional({ example: 1, description: 'Floor Zone ID' })
  @IsNumber()
  @IsOptional()
  floorZone?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  floorPlan?: number;

  @ApiPropertyOptional({ example: 1, description: 'Table Group ID (optional)' })
  @IsNumber()
  @IsOptional()
  parent_table_id?: number;
}
