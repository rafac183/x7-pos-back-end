import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

export class SetSupplySuppliersDto {
  @ApiProperty({ example: [1, 2, 3], description: 'Supplier IDs to associate' })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  supplierIds: number[];
}
