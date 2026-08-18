//src/restaurant-operations/dining-system/tables/dto/create-table.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Min,
  Max,
  IsIn,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TABLE_SHAPES,
  TABLE_MIN_SIZE_PX,
  TABLE_MAX_SIZE_PX,
} from '../../constants/table-shape.constants';

export class CreateTableDto {
  @ApiProperty({ example: 1, description: 'Merchant ID' })
  @IsNumber()
  merchant_id: number;

  @ApiProperty({ example: 'A1', description: 'Table number or identifier' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({
    example: 4,
    description: 'Seating capacity (minimum 1 person)',
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  capacity: number;

  @ApiProperty({ example: 'available', description: 'Table status' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ example: 'Near window', description: 'Location description' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    example: 90,
    description: 'Rotation for the table in degrees (0-360)',
  })
  @IsNumber()
  @Min(0)
  @Max(360)
  @IsNotEmpty()
  rotation: number;

  @ApiProperty({
    example: 'Circle',
    description: 'Shape of the table (e.g., Circle, Square, Rectangle)',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([...TABLE_SHAPES])
  shape: string;

  // Tamaño propio en píxeles de lienzo. Opcional: omitirlo mantiene el tamaño por
  // defecto de la forma, que es como se comportaban las mesas antes.
  @ApiPropertyOptional({
    example: 120,
    description: 'Custom table width in canvas pixels; omit for the shape default',
  })
  @IsOptional()
  @IsNumber()
  @Min(TABLE_MIN_SIZE_PX)
  @Max(TABLE_MAX_SIZE_PX)
  width?: number | null;

  @ApiPropertyOptional({
    example: 70,
    description: 'Custom table height in canvas pixels; omit for the shape default',
  })
  @IsOptional()
  @IsNumber()
  @Min(TABLE_MIN_SIZE_PX)
  @Max(TABLE_MAX_SIZE_PX)
  height?: number | null;

  @ApiProperty({
    example: 100,
    description: 'X coordinate for the table position on the floor plan',
  })
  @IsNumber()
  @IsNotEmpty()
  pos_x: number;

  @ApiProperty({
    example: 100,
    description: 'Y coordinate for the table position on the floor plan',
  })
  @IsNumber()
  @IsNotEmpty()
  pos_y: number;

  @ApiProperty({ example: 1, description: 'Floor Zone ID' })
  @IsNumber()
  @IsNotEmpty()
  floorZone: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @IsNotEmpty()
  floorPlan: number;

  @ApiProperty({ example: 1, description: 'Table Group ID (optional)' })
  @IsNumber()
  @IsOptional()
  parent_table_id?: number;
}
