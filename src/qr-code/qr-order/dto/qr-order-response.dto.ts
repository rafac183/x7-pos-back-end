//src/qr-code/qr-order/dto/qr-order-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';
import { QROrder } from '../entity/qr-order.entity';

export class QROrderResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1, description: 'Identifier of the Merchant' })
  merchant: { id: number };

  @ApiProperty({ example: 1, description: 'Identifier of the QR Location' })
  qrLocation: { id: number };

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Customer',
  })
  customer?: { id: number };

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Table',
  })
  table?: { id: number };

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Order',
  })
  order: { id: number };

  @ApiProperty({
    example: 'Special instructions for the order',
    description: 'Additional notes or instructions for the order',
  })
  notes?: string;

  @ApiProperty({
    example: 29.99,
    description: 'Total amount for the order',
  })
  total_amount?: number;

  @ApiProperty({
    example: 'accepted',
    enum: [
      'pending',
      'accepted',
      'preparing',
      'ready',
      'completed',
      'cancelled',
    ],
    description: 'Status of the QR Order',
  })
  qr_order_status: string;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive'] })
  status: string;
}

export class OneQROrderResponseDto extends SuccessResponse {
  @ApiProperty()
  data: QROrder;
}

export class AllQROrderResponseDto extends SuccessResponse {
  @ApiProperty()
  data: QROrder[];
}
