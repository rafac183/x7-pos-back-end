import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PurchaseOrder } from '../../purchase-order/entities/purchase-order.entity';
import { Product } from '../../products/entities/product.entity';
import { Variant } from '../../variants/entities/variant.entity';
import { Location } from '../../stocks/locations/entities/location.entity';
import { Supply } from 'src/inventory/supplies/entities/supply.entity';

@Entity('purchase_order_item')
export class PurchaseOrderItem {
  @ApiProperty({ example: 1, description: 'Purchase order item ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1, description: 'Associated purchase order ID' })
  @Column({ name: 'purchaseOrderId' })
  purchaseOrderId: number;

  @ApiPropertyOptional({ example: 1, description: 'Product ID' })
  @Column({ name: 'productId', nullable: true })
  productId: number | null;

  @ApiPropertyOptional({ example: 1, description: 'Product variant ID' })
  @Column({ name: 'variantId', nullable: true })
  variantId: number | null;

  @ApiProperty({ example: 5, description: 'Product quantity' })
  @Column({ type: 'int', default: 0 })
  quantity: number;

  @ApiProperty({ example: 10.5, description: 'Product unit price' })
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'unitPrice', default: 0 })
  unitPrice: number;

  @ApiProperty({ example: 52.5, description: 'Total item price' })
  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'totalPrice', default: 0 })
  totalPrice: number;

  @ApiPropertyOptional({ example: 1, description: 'Raw Material (Supply) ID' })
  @Column({ name: 'raw_material_id', nullable: true })
  rawMaterialId: number | null;

  @ApiPropertyOptional({ example: 'Box', description: 'Purchase unit description' })
  @Column({ type: 'varchar', length: 50, name: 'purchase_unit', nullable: true })
  purchaseUnit: string | null;

  @ApiPropertyOptional({ example: 10.0, description: 'Quantity ordered' })
  @Column({ type: 'decimal', precision: 14, scale: 4, name: 'quantity_ordered', nullable: true })
  quantityOrdered: number | null;

  @ApiPropertyOptional({ example: 15.5, description: 'Unit cost' })
  @Column({ type: 'decimal', precision: 14, scale: 4, name: 'unit_cost', nullable: true })
  unitCost: number | null;

  @ApiPropertyOptional({ example: 2.5, description: 'Tax amount' })
  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'tax_amount', default: 0, nullable: true })
  taxAmount: number | null;

  @ManyToOne(
    () => PurchaseOrder,
    (purchaseOrder) => purchaseOrder.purchaseOrderItems,
    {
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @ManyToOne(() => Product, (product) => product.purchaseOrderItems, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'productId' })
  product: Product | null;

  @ManyToOne(() => Variant, (variant) => variant.purchaseOrderItems, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'variantId' })
  variant: Variant | null;

  @ManyToOne(() => Supply, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'raw_material_id' })
  rawMaterial: Supply | null;

  @ApiProperty({ example: 3, description: 'Quantity of items physically received' })
  @Column({ type: 'int', name: 'received_quantity', default: 0 })
  receivedQuantity: number;

  @ApiProperty({ example: 1, description: 'Destination location ID' })
  @Column({ name: 'locationId', nullable: true })
  locationId: number;

  @ManyToOne(() => Location, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
