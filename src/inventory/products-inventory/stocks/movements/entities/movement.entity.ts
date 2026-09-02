import { Location } from '../../locations/entities/location.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Order } from 'src/restaurant-operations/pos/orders/entities/order.entity';
import { Shift } from 'src/restaurant-operations/shift/shifts/entities/shift.entity';
import { MovementsStatus } from '../constants/movements-status';
import { Item } from '../../items/entities/item.entity';
import { SupplierInvoice } from 'src/finance-hr/account-payable/supplier-invoices/entities/supplier-invoice.entity';

@Entity('stock_movement')
@Index(['orderId'])
@Index(['supplierInvoiceId'])
export class Movement {
  @ApiProperty({ example: 1, description: 'Movement ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 1,
    description: 'Stock Item ID associated with the movement',
  })
  @Column('int')
  stockItemId: number;

  @ManyToOne(() => Item, (item) => item.movements)
  @JoinColumn({ name: 'stockItemId' })
  item: Item;

  @ApiProperty({ example: 10, description: 'Quantity of the movement' })
  @Column('int')
  quantity: number;

  @ApiProperty({
    example: MovementsStatus.IN,
    description: 'Type of movement',
    enum: MovementsStatus,
  })
  @Column({
    type: 'enum',
    enum: MovementsStatus,
    default: MovementsStatus.IN,
  })
  type: MovementsStatus;

  @ApiProperty({
    example: 'REF-001',
    description: 'Movement reference (optional)',
    nullable: true,
  })
  @Column('varchar', { nullable: true })
  reference: string;

  @ApiProperty({
    example: 'Reason 1',
    description: 'Reason for the movement',
    nullable: true,
  })
  @Column('varchar', { nullable: true })
  reason: string;

  @ApiProperty({
    example: 123,
    description: 'Merchant ID associated to the category',
  })
  @Column({ type: 'int' })
  merchantId: number;

  @ManyToOne(() => Merchant, (merchant) => merchant.movements, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'merchantId' })
  merchant: Merchant;

  @ApiPropertyOptional({ example: 42 })
  @Column({ type: 'int', name: 'order_id', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @ApiPropertyOptional({ example: 3 })
  @Column({ type: 'int', name: 'shift_id', nullable: true })
  shiftId: number | null;

  @ManyToOne(() => Shift, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'shift_id' })
  shift: Shift | null;

  @ApiPropertyOptional({ example: 15 })
  @Column({ type: 'int', name: 'supplier_invoice_id', nullable: true })
  supplierInvoiceId: number | null;

  @ManyToOne(() => SupplierInvoice, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'supplier_invoice_id' })
  supplierInvoice: SupplierInvoice | null;

  @ApiPropertyOptional({ example: 1, description: 'Source Location ID' })
  @Column({ type: 'int', name: 'source_location_id', nullable: true })
  sourceLocationId: number | null;

  @ManyToOne(() => Location, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'source_location_id' })
  sourceLocation: Location | null;

  @ApiPropertyOptional({ example: 2, description: 'Destination Location ID' })
  @Column({ type: 'int', name: 'destination_location_id', nullable: true })
  destinationLocationId: number | null;

  @ManyToOne(() => Location, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'destination_location_id' })
  destinationLocation: Location | null;

  @ApiPropertyOptional({ example: 'Admin', description: 'User who created the movement' })
  @Column({ type: 'varchar', length: 255, name: 'created_by', nullable: true })
  createdBy: string | null;

  @ApiPropertyOptional({ example: 'TRANSFER', description: 'Raw material stock movement type' })
  @Column({ type: 'varchar', length: 50, name: 'movement_type', nullable: true })
  movementType: string | null;

  @ApiPropertyOptional({
    example: 12.5,
    description: 'Unit cost (WACC) applied on this movement',
  })
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 4,
    name: 'unit_cost',
    nullable: true,
  })
  unitCost: string | null;

  @ApiProperty({
    example: '2023-01-01T12:00:00Z',
    description: 'Movement creation date',
  })
  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
