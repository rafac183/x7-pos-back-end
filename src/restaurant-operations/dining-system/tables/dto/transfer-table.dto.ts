import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class TransferTableDto {
  @ApiProperty({ example: 4, description: 'Table the party is sitting at now' })
  @IsInt()
  @IsPositive()
  sourceTableId: number;

  @ApiProperty({ example: 9, description: 'Available table the party moves to' })
  @IsInt()
  @IsPositive()
  targetTableId: number;
}
