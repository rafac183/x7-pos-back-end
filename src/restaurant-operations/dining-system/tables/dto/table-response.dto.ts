import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';

export class MerchantInfoDto {
  @ApiProperty({ example: 1, description: 'Merchant ID' })
  id: number;

  @ApiProperty({ example: 'Restaurant ABC', description: 'Merchant name' })
  name: string;
}

export class FloorZoneInfoDto {
  @ApiProperty({ example: 1, description: 'Floor Zone ID' })
  id: number;

  @ApiProperty({ example: 'Main Dining Area', description: 'Floor Zone name' })
  name: string;
}

export class FloorPlanInfoDto {
  @ApiProperty({ example: 1, description: 'Floor Plan ID' })
  id: number;

  @ApiProperty({ example: 'First Floor', description: 'Floor Plan name' })
  name: string;
}

export class TableResponseDto {
  @ApiProperty({ example: 1, description: 'Unique identifier of the Table' })
  id: number;

  @ApiProperty({ example: 1, description: 'Merchant ID that owns the table' })
  merchant_id: number;

  @ApiProperty({ example: 'A1', description: 'Table number or identifier' })
  number: string;

  @ApiProperty({ example: 4, description: 'Seating capacity of the Table' })
  capacity: number;

  @ApiProperty({
    example: 'available',
    description: 'Current status of the Table',
  })
  status: string;

  @ApiProperty({
    example: 'Near window',
    description: 'Location description of the Table',
  })
  location: string;

  @ApiProperty({
    example: 90,
    description: 'Rotation for the table in degrees (0-360)',
  })
  rotation: number;

  @ApiProperty({
    example: 'Circle',
    description: 'Shape of the table (e.g., Circle, Square, Rectangle)',
  })
  shape: string;

  @ApiProperty({
    example: 120,
    nullable: true,
    description: 'Custom table width in canvas pixels; null = shape default',
  })
  width: number | null;

  @ApiProperty({
    example: 70,
    nullable: true,
    description: 'Custom table height in canvas pixels; null = shape default',
  })
  height: number | null;

  @ApiProperty({
    example: 100,
    description: 'X coordinate for the table position on the floor plan',
  })
  pos_x: number;

  @ApiProperty({
    example: 50,
    description: 'Y coordinate for the table position on the floor plan',
  })
  pos_y: number;

  @ApiProperty({
    type: MerchantInfoDto,
    description: 'Basic merchant information',
  })
  merchant: MerchantInfoDto;

  @ApiProperty({
    type: FloorZoneInfoDto,
    description: 'Basic floor zone information',
  })
  floorZone: FloorZoneInfoDto;

  @ApiProperty({
    type: FloorPlanInfoDto,
    description: 'Basic floor plan information',
  })
  floorPlan: FloorPlanInfoDto;

  @ApiProperty({
    example: [{ id: 2, number: 'B1' }],
    description: 'Child tables if this table is a parent table',
    required: false,
    nullable: true,
  })
  parent_table?: {
    id: number;
    number: string;
  } | null;
}

export class TableLittleResponseDto {
  @ApiProperty({ example: 1, description: 'Unique identifier of the Table' })
  id: number;

  @ApiProperty({ example: 'A1', description: 'Table number or identifier' })
  number: string;

  @ApiProperty({
    type: () => TableLittleResponseDto,
    nullable: true,
    description: 'Parent table details if this table is a child table',
  })
  parent_table?: TableLittleResponseDto | null;
}

export class OneTableResponseDto extends SuccessResponse {
  @ApiProperty({ type: TableResponseDto })
  data: TableResponseDto;
}
