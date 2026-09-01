import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Product } from 'src/inventory/products-inventory/products/entities/product.entity';
import { Variant } from 'src/inventory/products-inventory/variants/entities/variant.entity';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Movement } from '../../movements/entities/movement.entity';
import { Location } from '../../locations/entities/location.entity';

import { Supply } from 'src/inventory/supplies/entities/supply.entity';

@Entity({ name: 'stock_item' })
export class Item {
  @ApiProperty({ example: 1, description: 'Item ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 5, description: 'Current quantity' })
  @Column({ type: 'int' })
  currentQty: number;

  @ApiPropertyOptional({
    example: 10,
    description:
      'Minimum quantity before low-stock alerts; null disables LOW alerts',
  })
  @Column({ type: 'int', name: 'minimum_qty', nullable: true })
  minimumQty: number | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Product ID associated with the item',
  })
  @Column({ type: 'int', name: 'productId', nullable: true })
  productId?: number | null;

  @ManyToOne(() => Product, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'productId' })
  product?: Product | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Variant ID associated with the item',
  })
  @Column({ type: 'int', name: 'variantId', nullable: true })
  variantId?: number | null;

  @ManyToOne(() => Variant, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'variantId' })
  variant?: Variant | null;

  @ApiPropertyOptional({
    example: 1,
    description: 'Supply (Raw Material) ID associated with the item',
  })
  @Column({ type: 'int', name: 'supply_id', nullable: true })
  supplyId?: number | null;

  @ManyToOne(() => Supply, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'supply_id' })
  supply?: Supply | null;

  @ApiProperty({
    example: 1,
    description: 'Location ID associated with the item',
  })
  @Column({ type: 'int' })
  locationId: number;

  @ManyToOne(() => Location, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ApiPropertyOptional({
    example: 12.5,
    description:
      'Weighted average unit cost (WACC/CPP) for profitability at this location',
  })
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 4,
    name: 'weighted_average_unit_cost',
    nullable: true,
  })
  weightedAverageUnitCost: string | null;

  @OneToMany(() => Movement, (movement) => movement.item)
  movements: Movement[];
}
