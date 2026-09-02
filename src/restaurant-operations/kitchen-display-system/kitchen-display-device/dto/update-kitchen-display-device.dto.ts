import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateKitchenDisplayDeviceDto } from './create-kitchen-display-device.dto';
import { KitchenDisplayDeviceStatus } from '../constants/kitchen-display-device-status.enum';

export class UpdateKitchenDisplayDeviceDto extends PartialType(
  CreateKitchenDisplayDeviceDto,
) {
  @ApiPropertyOptional({
    example: KitchenDisplayDeviceStatus.ACTIVE,
    description: 'Device lifecycle status (ACTIVE or DELETED)',
    enum: KitchenDisplayDeviceStatus,
  })
  @IsOptional()
  @IsEnum(KitchenDisplayDeviceStatus)
  status?: KitchenDisplayDeviceStatus;
}
