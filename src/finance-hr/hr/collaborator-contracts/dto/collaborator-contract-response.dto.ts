import { ApiProperty } from '@nestjs/swagger';
import { SuccessResponse } from 'src/common/dtos/success-response.dto';
import { ContractType } from '../constants/contract-type.enum';
import { EmploymentType } from '../constants/employment-type.enum';
import { PayFrequency } from '../constants/pay-frequency.enum';

export class CollaboratorContractResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 1 })
  company_id: number;

  @ApiProperty({ example: 1 })
  merchant_id: number;

  @ApiProperty({ example: 1 })
  collaborator_id: number;

  @ApiProperty({ enum: ContractType })
  contract_type: ContractType;

  @ApiProperty({ enum: EmploymentType })
  employment_type: EmploymentType;

  @ApiProperty({ enum: PayFrequency })
  pay_frequency: PayFrequency;

  @ApiProperty({
    example: 22.5,
    description: 'Agreed wage for one pay period, already resolved from the payroll fields',
  })
  wage_rate: number;

  @ApiProperty({ example: 40 })
  working_hours_per_week: number;

  @ApiProperty({ example: '/uploads/contracts/12-signed.pdf', nullable: true })
  document_url: string | null;

  @ApiProperty({ example: 'contrato-juan-perez.pdf', nullable: true })
  document_name: string | null;

  @ApiProperty({ example: 500000 })
  base_salary: number;

  @ApiProperty({ example: 5000 })
  hourly_rate: number;

  @ApiProperty({ example: 1.5 })
  overtime_multiplier: number;

  @ApiProperty({ example: 2.0 })
  double_overtime_multiplier: number;

  @ApiProperty({ example: false })
  tips_included_in_payroll: boolean;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({ example: '2024-01-01' })
  start_date: string;

  @ApiProperty({ example: '2025-12-31', nullable: true })
  end_date: string | null;

  @ApiProperty()
  created_at: string;

  @ApiProperty()
  updated_at: string;

  @ApiProperty({
    nullable: true,
    description:
      'Collaborator the contract belongs to, hydrated so the directory does not need a second call per row',
    example: { id: 4, name: 'Juan Pérez', role: 'waiter' },
  })
  collaborator: { id: number; name: string; role: string } | null;
}

export class OneCollaboratorContractResponseDto extends SuccessResponse {
  @ApiProperty({ type: CollaboratorContractResponseDto })
  data: CollaboratorContractResponseDto;
}

export class ContractRevisionResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 12 })
  contract_id: number;

  @ApiProperty({ example: 'wage_rate' })
  field: string;

  @ApiProperty({ example: '22.50', nullable: true })
  previous_value: string | null;

  @ApiProperty({ example: '25.00', nullable: true })
  new_value: string | null;

  @ApiProperty({ example: 7, nullable: true })
  changed_by_user_id: number | null;

  @ApiProperty()
  created_at: string;
}

export class ContractRevisionsResponseDto extends SuccessResponse {
  @ApiProperty({ type: [ContractRevisionResponseDto] })
  data: ContractRevisionResponseDto[];
}
