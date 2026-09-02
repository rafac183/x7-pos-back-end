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
import { Shift } from 'src/restaurant-operations/shift/shifts/entities/shift.entity';

@Entity('time_entries')
export class TimeEntry {
  @ApiProperty({
    example: 1,
    description: 'Unique identifier of the time entry',
  })
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
    example: 1,
    nullable: true,
    description:
      'Scheduled shift this punch belongs to. Nullable: a manually logged entry (missed punch, retroactive shift) may have no schedule behind it.',
  })
  @Column({ name: 'shift_id', nullable: true })
  shift_id: number | null;

  @ManyToOne(() => Shift, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift | null;

  @ApiProperty({
    example: '2024-01-15T08:00:00Z',
    description: 'Clock in timestamp',
  })
  @Column({ type: 'timestamp', name: 'clock_in' })
  clock_in: Date;

  @ApiProperty({
    example: '2024-01-15T16:00:00Z',
    description: 'Clock out timestamp',
    nullable: true,
  })
  @Column({ type: 'timestamp', name: 'clock_out', nullable: true })
  clock_out: Date | null;

  @ApiProperty({ example: 8, description: 'Regular hours worked' })
  @Column({
    type: 'decimal',
    precision: 6,
    scale: 2,
    name: 'regular_hours',
    default: 0,
  })
  regular_hours: number;

  @ApiProperty({ example: 0, description: 'Overtime hours' })
  @Column({
    type: 'decimal',
    precision: 6,
    scale: 2,
    name: 'overtime_hours',
    default: 0,
  })
  overtime_hours: number;

  @ApiProperty({ example: 0, description: 'Double overtime hours' })
  @Column({
    type: 'decimal',
    precision: 6,
    scale: 2,
    name: 'double_overtime_hours',
    default: 0,
  })
  double_overtime_hours: number;

  @ApiProperty({ example: false, description: 'Whether the entry is approved' })
  @Column({ type: 'boolean', default: false })
  approved: boolean;

  @ApiProperty({
    example: 45,
    description:
      'Unpaid break minutes logged inside the punch interval. Deducted from the raw interval to get net payable hours.',
  })
  @Column({ type: 'int', name: 'break_minutes', default: 0 })
  break_minutes: number;

  @ApiProperty({
    example: 'Missed Punch',
    nullable: true,
    description:
      'Why the entry was logged or corrected by hand. Mandatory on every manual write; null on punches the clock itself recorded.',
  })
  @Column({ type: 'varchar', length: 255, name: 'adjustment_reason', nullable: true })
  adjustment_reason: string | null;

  @ApiProperty({
    example: true,
    description: 'True once a supervisor has corrected the punch. Never goes back to false.',
  })
  @Column({ type: 'boolean', name: 'is_edited', default: false })
  is_edited: boolean;

  @ApiProperty({
    example: 7,
    nullable: true,
    description: 'User who performed the last correction',
  })
  @Column({ type: 'int', name: 'edited_by_user_id', nullable: true })
  edited_by_user_id: number | null;

  @ApiProperty({ nullable: true, description: 'When the last correction happened' })
  @Column({ type: 'timestamp', name: 'edited_at', nullable: true })
  edited_at: Date | null;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updated_at: Date;
}
