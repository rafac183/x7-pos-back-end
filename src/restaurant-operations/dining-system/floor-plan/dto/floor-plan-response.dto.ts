//src/restaurant-operations/dining-system/floor-plan/dto/floor-plan-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';

export class FloorPlanResponseDto {
  @ApiProperty({
    example: 1,
    description: 'Unique identifier of the Floor Plan',
  })
  id: number;

  @ApiProperty({
    example: 'Main Floor Plan',
    description: 'Name of the Floor Plan',
  })
  name: string;

  @ApiProperty({
    example: 500,
    description: 'Width of the floor plan in pixels',
  })
  width: number;

  @ApiProperty({
    example: 300,
    description: 'Height of the floor plan in pixels',
  })
  height: number;

  // `null` = rectángulo completo width × height (planos anteriores a este campo).
  @ApiProperty({
    required: false,
    nullable: true,
    example: '[{"x":0,"y":0},{"x":800,"y":0},{"x":800,"y":600},{"x":0,"y":600}]',
    description:
      'Room outline polygon serialized as JSON, in canvas pixels. Null means the full width × height rectangle.',
  })
  outline: string | null;

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
}

export class OneFloorPlanResponseDto extends SuccessResponse {
  @ApiProperty()
  data: FloorPlanResponseDto;
}

export class AllFloorPlanResponseDto extends SuccessResponse {
  @ApiProperty()
  data: FloorPlanResponseDto[];
}
