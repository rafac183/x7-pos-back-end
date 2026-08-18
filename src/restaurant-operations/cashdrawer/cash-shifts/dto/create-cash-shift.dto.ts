import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, Min } from 'class-validator';

export class CreateCashShiftDto {
  @ApiProperty({
    example: 1,
    description: 'ID of the physical cash drawer where the shift is opened',
  })
  @IsInt()
  @IsPositive()
  cashDrawerId: number;

  @ApiProperty({
    example: 1000.0,
    description: 'Opening balance of the cash shift',
  })
  @IsNumber()
  @Min(0)
  openingBalance: number;
}
