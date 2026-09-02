import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Collaborator } from '../../collaborators/entities/collaborator.entity';
import { ContractType } from '../constants/contract-type.enum';
import { EmploymentType } from '../constants/employment-type.enum';
import { PayFrequency } from '../constants/pay-frequency.enum';

@Entity('collaborator_contracts')
export class CollaboratorContract {
  @ApiProperty({ example: 1, description: 'Unique identifier of the contract' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1, description: 'Company ID' })
  @Column({ name: 'company_id' })
  company_id: number;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty({ example: 1, description: 'Merchant ID' })
  @Column({ name: 'merchant_id' })
  merchant_id: number;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @ApiProperty({ example: 1, description: 'Collaborator ID' })
  @Column({ name: 'collaborator_id' })
  collaborator_id: number;

  @ManyToOne(() => Collaborator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collaborator_id' })
  collaborator: Collaborator;

  @ApiProperty({
    example: ContractType.HOURLY,
    enum: ContractType,
    description: 'Type of contract: hourly, salary, or mixed',
  })
  @Column({ type: 'varchar', length: 50, name: 'contract_type' })
  contract_type: ContractType;

  @ApiProperty({
    example: EmploymentType.FULL_TIME,
    enum: EmploymentType,
    description:
      'Employment relationship: full_time, part_time, temporary, freelance or internship',
  })
  @Column({
    type: 'varchar',
    length: 30,
    name: 'employment_type',
    default: EmploymentType.FULL_TIME,
  })
  employment_type: EmploymentType;

  @ApiProperty({
    example: PayFrequency.HOURLY,
    enum: PayFrequency,
    description: 'Period covered by the agreed wage rate',
  })
  @Column({
    type: 'varchar',
    length: 20,
    name: 'pay_frequency',
    default: PayFrequency.MONTHLY,
  })
  pay_frequency: PayFrequency;

  @ApiProperty({
    example: 40,
    description: 'Contracted working hours per week',
  })
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    name: 'working_hours_per_week',
    default: 40,
  })
  working_hours_per_week: number;

  @ApiProperty({
    example: '/uploads/contracts/12-signed.pdf',
    description: 'Public path of the signed legal document',
    nullable: true,
  })
  @Column({ type: 'varchar', length: 512, name: 'document_url', nullable: true })
  document_url: string | null;

  @ApiProperty({
    example: 'contrato-juan-perez.pdf',
    description: 'Original file name, kept for display and download',
    nullable: true,
  })
  @Column({ type: 'varchar', length: 255, name: 'document_name', nullable: true })
  document_name: string | null;

  @ApiProperty({
    example: 500000,
    description: 'Base salary (for salary/mixed)',
  })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'base_salary',
    default: 0,
  })
  base_salary: number;

  @ApiProperty({ example: 5000, description: 'Hourly rate (for hourly/mixed)' })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'hourly_rate',
    default: 0,
  })
  hourly_rate: number;

  @ApiProperty({ example: 1.5, description: 'Overtime multiplier (e.g. 1.5)' })
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    name: 'overtime_multiplier',
    default: 1.5,
  })
  overtime_multiplier: number;

  @ApiProperty({ example: 2.0, description: 'Double overtime multiplier' })
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    name: 'double_overtime_multiplier',
    default: 2.0,
  })
  double_overtime_multiplier: number;

  @ApiProperty({
    example: true,
    description: 'Whether tips are included in payroll',
  })
  @Column({ type: 'boolean', name: 'tips_included_in_payroll', default: false })
  tips_included_in_payroll: boolean;

  @ApiProperty({ example: true, description: 'Whether the contract is active' })
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ApiProperty({ example: '2024-01-01', description: 'Contract start date' })
  @Column({ type: 'date', name: 'start_date' })
  start_date: Date;

  @ApiProperty({
    example: '2025-12-31',
    description: 'Contract end date (optional)',
    nullable: true,
  })
  @Column({ type: 'date', name: 'end_date', nullable: true })
  end_date: Date | null;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;

  @ApiProperty({ description: 'Last amendment timestamp' })
  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updated_at: Date;
}
