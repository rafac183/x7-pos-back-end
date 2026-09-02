import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Rastro de cada traslado de comensales entre mesas.
 *
 * Se guarda plano (ids, no relaciones) a propósito: es un registro de auditoría y tiene que
 * seguir siendo legible aunque la mesa origen se borre después. Nada lo actualiza nunca —
 * sólo se inserta y se lee.
 */
@Entity('table_transfer_log')
@Index(['merchant_id', 'created_at'])
export class TableTransferLog {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1, description: 'Merchant that owns both tables' })
  @Column({ name: 'merchant_id' })
  merchant_id: number;

  @ApiProperty({ example: 4, description: 'Table the party was sitting at' })
  @Column({ name: 'source_table_id' })
  source_table_id: number;

  @ApiProperty({ example: 9, description: 'Table the party moved to' })
  @Column({ name: 'target_table_id' })
  target_table_id: number;

  @ApiProperty({
    example: 120,
    nullable: true,
    description: 'Open order re-bound by the transfer, when there was one',
  })
  @Column({ name: 'order_id', type: 'int', nullable: true })
  order_id: number | null;

  @ApiProperty({ example: 7, description: 'User who executed the transfer' })
  @Column({ name: 'user_id' })
  user_id: number;

  @ApiProperty({ example: '2026-08-19T12:00:00Z' })
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  created_at: Date;
}
