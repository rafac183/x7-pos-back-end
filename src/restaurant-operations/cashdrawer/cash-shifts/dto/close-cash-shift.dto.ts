import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class CloseCashShiftDto {
  @ApiProperty({
    example: 1480.0,
    description: 'Amount declared by the cashier when closing the shift',
  })
  @IsNumber()
  @Min(0)
  declaredAmount: number;
}
