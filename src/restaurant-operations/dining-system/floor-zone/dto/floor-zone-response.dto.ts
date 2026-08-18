//src/restaurant-operations/dining-system/floor-zone/dto/floor-zone-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { FloorPlan } from 'src/restaurant-operations/dining-system/floor-plan/entity/floor-plan.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';

export class FloorZoneResponseDto {
  @ApiProperty({
    example: 1,
    description: 'Unique identifier of the Floor Zone',
  })
  id: number;

  @ApiProperty({
    example: 'Main Dining Area',
    description: 'Name of the Floor Zone',
  })
  name: string;

  @ApiProperty({
    example: 'Blue',
    description: 'Color associated with the Floor Zone for UI representation',
  })
  color: string;

  @ApiProperty({
    example: '[{"x":0,"y":0},{"x":400,"y":0},{"x":400,"y":300}]',
    nullable: true,
    description: 'Zone area polygon as JSON, in canvas pixels; null = no drawn area',
  })
  area: string | null;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Merchant',
  })
  merchant: Merchant;

  @ApiProperty({
    example: 'active',
    enum: ['active', 'inactive'],
  })
  status: string;

  @ApiProperty({
    type: () => FloorPlan,
    description: 'Floor Plan associated with the Floor Zone',
  })
  floorPlan: FloorPlan;
}

export class OneFloorZoneResponseDto extends SuccessResponse {
  @ApiProperty()
  data: FloorZoneResponseDto;
}

export class AllFloorZoneResponseDto extends SuccessResponse {
  @ApiProperty()
  data: FloorZoneResponseDto[];
}
