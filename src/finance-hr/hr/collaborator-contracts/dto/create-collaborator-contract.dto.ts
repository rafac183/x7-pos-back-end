import {
  IsNumber,
  IsPositive,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsDateString,
  Min,
  Max,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType } from '../constants/contract-type.enum';
import { EmploymentType } from '../constants/employment-type.enum';
import { PayFrequency } from '../constants/pay-frequency.enum';

export class CreateCollaboratorContractDto {
  @ApiProperty({ example: 1, description: 'Company ID' })
  @IsNumber()
  @IsPositive()
  company_id: number;

  @ApiProperty({ example: 1, description: 'Merchant ID' })
  @IsNumber()
  @IsPositive()
  merchant_id: number;

  @ApiProperty({ example: 1, description: 'Collaborator ID' })
  @IsNumber()
  @IsPositive()
  collaborator_id: number;

  @ApiPropertyOptional({
    example: ContractType.HOURLY,
    enum: ContractType,
    description:
      'Payroll model: hourly, salary or mixed. Optional — derived from pay_frequency when omitted.',
  })
  @IsOptional()
  @IsEnum(ContractType)
  contract_type?: ContractType;

  @ApiPropertyOptional({
    example: 500000,
    description: 'Base salary (for salary/mixed)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  base_salary?: number;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Hourly rate (for hourly/mixed)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourly_rate?: number;

  @ApiPropertyOptional({
    example: 1.5,
    description: 'Overtime multiplier',
    default: 1.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  overtime_multiplier?: number;

  @ApiPropertyOptional({
    example: 2.0,
    description: 'Double overtime multiplier',
    default: 2.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  double_overtime_multiplier?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether tips are included in payroll',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  tips_included_in_payroll?: boolean;

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether the contract is active. Optional; defaults to true when creating.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;


  @ApiPropertyOptional({
    example: EmploymentType.FULL_TIME,
    enum: EmploymentType,
    description: 'Employment relationship. Defaults to full_time.',
  })
  @IsOptional()
  @IsEnum(EmploymentType)
  employment_type?: EmploymentType;

  @ApiPropertyOptional({
    example: PayFrequency.HOURLY,
    enum: PayFrequency,
    description:
      'Period covered by wage_rate. Drives whether the amount lands on hourly_rate or base_salary.',
  })
  @IsOptional()
  @IsEnum(PayFrequency)
  pay_frequency?: PayFrequency;

  @ApiPropertyOptional({
    example: 22.5,
    description:
      'Agreed wage for one pay period. Stored as hourly_rate when pay_frequency is hourly, as base_salary otherwise.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  wage_rate?: number;

  @ApiPropertyOptional({ example: 40, description: 'Contracted hours per week' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(168)
  working_hours_per_week?: number;

  @ApiPropertyOptional({
    example: '/uploads/contracts/12-signed.pdf',
    description: 'Path of the signed document, normally set by the upload endpoint',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  document_url?: string | null;

  @ApiPropertyOptional({ example: 'contrato-juan-perez.pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  document_name?: string | null;

  @ApiProperty({ example: '2024-01-01', description: 'Contract start date' })
  @IsDateString()
  start_date: string;

  @ApiPropertyOptional({
    example: '2025-12-31',
    description: 'Contract end date',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;
}
