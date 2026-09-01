import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceiveItemLineDto {
  @ApiProperty({ example: 1, description: 'Purchase order item ID' })
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @ApiProperty({ example: 10.5, description: 'Quantity received physically in this transaction' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  receivedQuantity: number;
}

export class ReceiveItemsDto {
  @ApiProperty({
    description: 'Line items to receive',
    type: [ReceiveItemLineDto],
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemLineDto)
  items: ReceiveItemLineDto[];
}
