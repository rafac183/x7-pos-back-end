import {
  IsNumber,
  IsPositive,
  IsBoolean,
  IsOptional,
  IsDateString,
  Min,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTimeEntryDto {
  @ApiPropertyOptional({ example: 1, description: 'Company ID' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  company_id?: number;

  @ApiPropertyOptional({ example: 1, description: 'Merchant ID' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  merchant_id?: number;

  @ApiPropertyOptional({ example: 1, description: 'Collaborator ID' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  collaborator_id?: number;

  @ApiPropertyOptional({ example: 1, description: 'Shift ID' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  shift_id?: number;

  @ApiPropertyOptional({
    example: '2024-01-15T08:00:00.000Z',
    description: 'Clock in',
  })
  @IsOptional()
  @IsDateString()
  clock_in?: string;

  @ApiPropertyOptional({
    example: '2024-01-15T16:00:00.000Z',
    description: 'Clock out',
  })
  @IsOptional()
  @IsDateString()
  clock_out?: string | null;

  @ApiPropertyOptional({ example: 8, description: 'Regular hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  regular_hours?: number;

  @ApiPropertyOptional({ example: 0, description: 'Overtime hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  overtime_hours?: number;

  @ApiPropertyOptional({ example: 0, description: 'Double overtime hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  double_overtime_hours?: number;

  @ApiPropertyOptional({ example: true, description: 'Approved' })
  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @ApiPropertyOptional({
    example: 45,
    description: 'Unpaid break minutes inside the punch interval',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  break_minutes?: number;

  @ApiPropertyOptional({
    example: 'Missed Punch',
    description:
      'Justification for the correction. MANDATORY: the service rejects any update that changes the punch without one, because the audit trail would lose why it changed.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  adjustment_reason?: string;
}
