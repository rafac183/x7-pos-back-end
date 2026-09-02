import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CreateKitchenStationDto } from './create-kitchen-station.dto';
import { KitchenStationStatus } from '../constants/kitchen-station-status.enum';

export class UpdateKitchenStationDto extends PartialType(
  CreateKitchenStationDto,
) {
  @ApiPropertyOptional({
    example: true,
    description: 'Whether the kitchen station is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: KitchenStationStatus.ACTIVE,
    enum: KitchenStationStatus,
    description: 'Status of the kitchen station (active, deleted)',
  })
  @IsOptional()
  @IsEnum(KitchenStationStatus)
  status?: KitchenStationStatus;
}
