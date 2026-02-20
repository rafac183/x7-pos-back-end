//src//qr-code/qr-order/dto/create-qr-order.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { QROrderStatus } from 'src/qr-code/constants/qr-order-status.enum';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  IsEnum,
} from 'class-validator';

export class CreateQROrderDto {
  @ApiProperty({ example: 1, description: 'Identifier of the Merchant' })
  @IsInt()
  @IsNotEmpty()
  merchant: number;

  @ApiProperty({ example: 1, description: 'Identifier of the QR Location' })
  @IsInt()
  @IsNotEmpty()
  qrLocation: number;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Customer',
  })
  @IsInt()
  @IsOptional()
  customer?: number;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Table',
  })
  @IsInt()
  @IsOptional()
  table?: number;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Order',
  })
  @IsInt()
  @IsNotEmpty()
  order: number;

  @ApiProperty({
    example: 'Special instructions for the order',
    description: 'Additional notes or instructions for the order',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    example: 29.99,
    description: 'Total amount for the order',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  total_amount?: number;

  @ApiProperty({
    example: QROrderStatus.ACCEPTED,
    enum: QROrderStatus,
    description: 'Status of the QR Order',
  })
  @IsEnum(QROrderStatus)
  @IsNotEmpty()
  qr_order_status: QROrderStatus;

  @ApiProperty({ example: 'active', enum: ['active', 'inactive'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['active', 'inactive'])
  status: string;
}
