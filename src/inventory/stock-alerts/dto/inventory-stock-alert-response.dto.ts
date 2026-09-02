import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryStockAlertType } from '../constants/inventory-stock-alert-type.enum';
import { InventoryStockAlertStatus } from '../constants/inventory-stock-alert-status.enum';

export class InventoryStockAlertResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  merchantId: number;

  @ApiProperty()
  stockItemId: number;

  @ApiPropertyOptional({ nullable: true })
  productId: number | null;

  @ApiPropertyOptional({ nullable: true })
  variantId: number | null;

  @ApiPropertyOptional({ nullable: true })
  supplyId?: number | null;

  @ApiProperty()
  locationId: number;

  @ApiPropertyOptional({ nullable: true })
  categoryId: number | null;

  @ApiProperty({ enum: InventoryStockAlertType })
  alertType: InventoryStockAlertType;

  @ApiProperty()
  currentQty: number;

  @ApiPropertyOptional({ nullable: true })
  minimumQty: number | null;

  @ApiProperty({ enum: InventoryStockAlertStatus })
  status: InventoryStockAlertStatus;

  @ApiProperty()
  triggeredAt: Date;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  emailSentAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  productName: string | null;

  @ApiPropertyOptional({ nullable: true })
  variantName: string | null;

  @ApiPropertyOptional({ nullable: true })
  locationName: string | null;

  @ApiPropertyOptional({ nullable: true })
  categoryName: string | null;
}
