import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';
import { MerchantResponseDto } from 'src/platform-saas/merchants/dtos/merchant-response.dto';

export class LocationResponseDto {
  @ApiProperty({ example: 1, description: 'Location ID' })
  id: number;

  @ApiProperty({ example: 'New York', description: 'Location name' })
  name: string;

  @ApiProperty({ example: 'MAIN-01', description: 'Location code', required: false })
  code?: string;

  @ApiProperty({ example: '123 Main St', description: 'Location address', required: false })
  address?: string;

  @ApiProperty({ example: true, description: 'Is main storage hub', required: false })
  isMainStorage?: boolean;

  @ApiProperty({
    type: () => MerchantResponseDto,
    nullable: true,
    description: 'Associated merchant details',
  })
  merchant: MerchantResponseDto | null;

  @ApiProperty({ example: true, description: 'Is location active' })
  isActive: boolean;
}

export class LocationLittleResponseDto {
  @ApiProperty({ example: 1, description: 'Location ID' })
  id: number;

  @ApiProperty({ example: 'New York', description: 'Location name' })
  name: string;
}

export class OneLocationResponse extends SuccessResponse {
  @ApiProperty()
  data: LocationResponseDto;
}
