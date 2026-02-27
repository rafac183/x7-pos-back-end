//src//qr-code/qr-order/entity/qr-order.entity.ts
import { Merchant } from 'src/merchants/entities/merchant.entity';
import { QRLocation } from 'src/qr-code/qr-location/entity/qr-location.entity';
import { Customer } from 'src/customers/entities/customer.entity';
import { Table } from 'src/tables/entities/table.entity';
import { Order } from 'src/orders/entities/order.entity';
import { QROrderStatus } from 'src/qr-code/constants/qr-order-status.enum';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity({ name: 'qr_order' })
export class QROrder {
  @ApiProperty({
    example: 1,
    description: 'Unique identifier of the QR Order',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Merchant related',
  })
  @ManyToOne(() => Merchant, { eager: true })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the QR Location related',
  })
  @ManyToOne(() => QRLocation, { eager: true })
  @JoinColumn({ name: 'qr_location_id' })
  qrLocation: QRLocation;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Customer related (if applicable)',
  })
  @ManyToOne(() => Customer, { eager: true, nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Table related (if applicable)',
  })
  @ManyToOne(() => Table, { eager: true, nullable: true })
  @JoinColumn({ name: 'table_id' })
  table: Table;

  @ApiProperty({
    example: 1,
    description: 'Identifier of the Order related',
  })
  @ManyToOne(() => Order, { eager: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'enum', enum: QROrderStatus })
  qr_order_status: QROrderStatus;

  @Column({ type: 'text' })
  notes: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total_amount: number;

  @ApiProperty({
    example: 'active',
    description: 'Status of the QR ORDER',
  })
  @Column({ type: 'varchar', length: 50 })
  status: string;
}
