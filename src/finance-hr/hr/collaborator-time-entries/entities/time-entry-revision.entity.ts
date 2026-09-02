import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Historial de correcciones de un fichaje.
 *
 * Cada ajuste de un supervisor inserta una fila con el ANTES y el DESPUÉS. La tabla sólo
 * se inserta y se lee: nada la actualiza ni la borra, porque su valor para nómina está
 * justamente en que no se pueda reescribir. Guarda valores planos (no relaciones) para que
 * el histórico siga siendo legible aunque el fichaje original se elimine después.
 */
@Entity('time_entry_revision')
@Index(['time_entry_id', 'created_at'])
export class TimeEntryRevision {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 42, description: 'Time entry this revision belongs to' })
  @Column({ name: 'time_entry_id' })
  time_entry_id: number;

  @ApiProperty({ example: 7, description: 'Supervisor who made the correction' })
  @Column({ name: 'edited_by_user_id' })
  edited_by_user_id: number;

  @ApiProperty({
    example: 'Missed Punch',
    description: 'Justification the supervisor supplied',
  })
  @Column({ type: 'varchar', length: 255, name: 'adjustment_reason' })
  adjustment_reason: string;

  @ApiProperty({ nullable: true, description: 'Clock-in before the correction' })
  @Column({ type: 'timestamp', name: 'previous_clock_in', nullable: true })
  previous_clock_in: Date | null;

  @ApiProperty({ nullable: true, description: 'Clock-out before the correction' })
  @Column({ type: 'timestamp', name: 'previous_clock_out', nullable: true })
  previous_clock_out: Date | null;

  @ApiProperty({ example: 30, nullable: true, description: 'Break minutes before' })
  @Column({ type: 'int', name: 'previous_break_minutes', nullable: true })
  previous_break_minutes: number | null;

  @ApiProperty({ nullable: true, description: 'Clock-in after the correction' })
  @Column({ type: 'timestamp', name: 'new_clock_in', nullable: true })
  new_clock_in: Date | null;

  @ApiProperty({ nullable: true, description: 'Clock-out after the correction' })
  @Column({ type: 'timestamp', name: 'new_clock_out', nullable: true })
  new_clock_out: Date | null;

  @ApiProperty({ example: 45, nullable: true, description: 'Break minutes after' })
  @Column({ type: 'int', name: 'new_break_minutes', nullable: true })
  new_break_minutes: number | null;

  @ApiProperty({ description: 'When the correction was recorded' })
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;
}
