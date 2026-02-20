//src/qr-code/qr-order/dto/paginated-qr-order-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';
import { QROrderResponseDto } from './qr-order-response.dto';

export class PaginatedQROrderResponseDto extends SuccessResponse {
  @ApiProperty({
    description: 'List of QR Orders',
    type: [QROrderResponseDto],
  })
  data: QROrderResponseDto[];

  @ApiProperty({
    description: 'Pagination info',
    example: {
      total: 42,
      page: 1,
      limit: 10,
      totalPages: 5,
    },
  })
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
