import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierPaymentAllocationDto {
  // Mutually exclusive with credit_note_id: exactly one funding source must be set.
  // The XOR itself lives in the service so it also covers partial updates.
  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @IsPositive()
  payment_id?: number | null;

  @ApiPropertyOptional({ example: 4, nullable: true })
  @IsOptional()
  @IsInt()
  @IsPositive()
  credit_note_id?: number | null;

  @ApiProperty({ example: 5 })
  @IsInt()
  @IsPositive()
  supplier_id: number;

  @ApiProperty({ example: 'INV-2026-001' })
  @IsString()
  @MaxLength(100)
  document_number: string;

  @ApiProperty({ example: 'invoice' })
  @IsString()
  @MaxLength(50)
  document_type: string;

  @ApiProperty({ example: 350.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allocated_amount: number;
}
