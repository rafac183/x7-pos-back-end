import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min } from 'class-validator';

export class CreateCashDrawerDto {
  @ApiProperty({
    example: 100.0,
    description: 'Opening balance amount in the cash drawer',
  })
  @IsNumber({}, { message: 'Opening balance must be a valid number' })
  @IsNotEmpty({ message: 'Opening balance is required' })
  @Min(0, { message: 'Opening balance must be greater than or equal to 0' })
  openingBalance: number;
}
