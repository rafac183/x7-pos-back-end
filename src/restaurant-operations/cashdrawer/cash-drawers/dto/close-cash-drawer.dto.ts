import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, Min } from 'class-validator';

export class CloseCashDrawerDto {
  @ApiProperty({
    example: 150.5,
    description: 'Physical cash count entered to close the cash drawer',
  })
  @IsNumber({}, { message: 'Closing balance must be a valid number' })
  @IsNotEmpty({ message: 'Closing balance is required' })
  @Min(0, { message: 'Closing balance must be greater than or equal to 0' })
  closingBalance: number;
}
