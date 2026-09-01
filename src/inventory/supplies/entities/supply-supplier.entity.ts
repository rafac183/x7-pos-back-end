import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Supply } from './supply.entity';
import { Supplier } from 'src/core/business-partners/suppliers/entities/supplier.entity';

@Entity('supply_suppliers')
@Index(['supply', 'supplier'], { unique: true })
export class SupplySupplier {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Supply, (supply) => supply.suppliers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supply_id' })
  supply: Supply;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @CreateDateColumn()
  created_at: Date;
}
