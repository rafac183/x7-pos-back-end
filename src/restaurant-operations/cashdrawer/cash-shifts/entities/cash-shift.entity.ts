import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Merchant } from '../../../../platform-saas/merchants/entities/merchant.entity';
import { CashDrawer } from '../../cash-drawers/entities/cash-drawer.entity';
import { Collaborator } from '../../../../finance-hr/hr/collaborators/entities/collaborator.entity';
import { CashShiftStatus } from '../constants/cash-shift-status.enum';
import type { CashTransaction } from '../../cash-transactions/entities/cash-transaction.entity';
import type { CashMovement } from '../../cash-movements/entities/cash-movement.entity';

@Entity('cash_shifts')
export class CashShift {
    @ApiProperty({ example: 1, description: 'Unique identifier of the CashShift' })
    @PrimaryGeneratedColumn()
    id: number;

    @ApiProperty({ example: 1, description: 'Merchant ID' })
    @Column({ type: 'int', name: 'merchant_id' })
    merchantId: number;

    @ApiProperty({ example: 1, description: 'Cash Drawer ID' })
    @Column({ type: 'int', name: 'cash_drawer_id' })
    cashDrawerId: number;

    @ApiProperty({ example: 1, description: 'Collaborator who opened the shift' })
    @Column({ type: 'int', name: 'opened_by' })
    openedBy: number;

    @ApiPropertyOptional({ example: 2, description: 'Collaborator who closed the shift' })
    @Column({ type: 'int', name: 'closed_by', nullable: true })
    closedBy: number | null;

    @ApiProperty({ example: 1000.0, description: 'Opening balance of the cash shift' })
    @Column({ type: 'decimal', precision: 12, scale: 2, name: 'opening_balance' })
    openingBalance: number;

    @ApiPropertyOptional({ example: 1500.0, description: 'System-calculated balance at closing' })
    @Column({ type: 'decimal', precision: 12, scale: 2, name: 'system_amount', nullable: true })
    systemAmount: number | null;

    @ApiPropertyOptional({ example: 1480.0, description: 'Amount declared by cashier at closing' })
    @Column({ type: 'decimal', precision: 12, scale: 2, name: 'declared_amount', nullable: true })
    declaredAmount: number | null;

    @ApiPropertyOptional({ example: -20.0, description: 'Difference: declaredAmount - systemAmount' })
    @Column({ type: 'decimal', precision: 12, scale: 2, name: 'difference', nullable: true })
    difference: number | null;

    @ApiProperty({
        enum: CashShiftStatus,
        example: CashShiftStatus.OPEN,
        description: 'Status of the cash shift',
    })
    @Column({
        type: 'enum',
        enum: CashShiftStatus,
        default: CashShiftStatus.OPEN,
    })
    status: CashShiftStatus;

    @ApiProperty({ example: '2024-01-15T08:00:00Z', description: 'When the shift was opened' })
    @CreateDateColumn({ type: 'timestamp', name: 'opened_at' })
    openedAt: Date;

    @ApiPropertyOptional({ example: '2024-01-15T20:00:00Z', description: 'When the shift was closed' })
    @Column({ type: 'timestamp', name: 'closed_at', nullable: true })
    closedAt: Date | null;

    // ── Relations ───────────────────────────────────────────────────────────────

    @ManyToOne(() => Merchant, { nullable: false })
    @JoinColumn({ name: 'merchant_id' })
    merchant: Merchant;

    @ManyToOne(() => CashDrawer, { nullable: false })
    @JoinColumn({ name: 'cash_drawer_id' })
    cashDrawer: CashDrawer;

    @ManyToOne(() => Collaborator, { nullable: false })
    @JoinColumn({ name: 'opened_by' })
    openedByCollaborator: Collaborator;

    @ManyToOne(() => Collaborator, { nullable: true })
    @JoinColumn({ name: 'closed_by' })
    closedByCollaborator: Collaborator | null;

    @OneToMany('CashTransaction', (ct: CashTransaction) => ct.cashShift)
    cashTransactions: CashTransaction[];

    @OneToMany('CashMovement', (cm: CashMovement) => cm.cashShift)
    cashMovements: CashMovement[];
}
