import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Company } from 'src/platform-saas/companies/entities/company.entity';
import { RawMaterialCategory } from '../categories/entities/raw-material-category.entity';
import { SupplyUnit } from '../constants/supply-unit.enum';
import { SupplySupplier } from './supply-supplier.entity';

@Entity('supplies')
@Index(['company_id', 'code'], { unique: true })
export class Supply {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1, description: 'Company identifier' })
  @Column({ type: 'int' })
  company_id: number;

  @ManyToOne(() => Company, { eager: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty({
    example: 'TOMATO_PASTE',
    description: 'Unique supply code within the company',
  })
  @Column({ type: 'varchar', length: 80 })
  code: string;

  @ApiPropertyOptional({
    example: 'SKU-12345',
    description: 'SKU of the raw material',
  })
  @Column({ type: 'varchar', length: 80, nullable: true })
  sku?: string | null;

  @ApiProperty({ example: 'Tomato paste', description: 'Supply name' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiPropertyOptional({ example: 1, description: 'Raw Material Category ID' })
  @Column({ type: 'int', name: 'category_id', nullable: true })
  category_id?: number | null;

  @ManyToOne(() => RawMaterialCategory, (cat) => cat.supplies, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'category_id' })
  category?: RawMaterialCategory | null;

  @ApiProperty({ enum: SupplyUnit, example: SupplyUnit.GRAM })
  @Column({ type: 'enum', enum: SupplyUnit, default: SupplyUnit.UNIT })
  unit: SupplyUnit;

  @ApiPropertyOptional({ example: 'kg', description: 'Purchase unit (e.g. kg, liters, box)' })
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'purchase_unit' })
  purchase_unit?: string | null;

  @ApiPropertyOptional({ example: 'g', description: 'Consumption unit (e.g. grams, ml, units)' })
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'consumption_unit' })
  consumption_unit?: string | null;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Conversion factor from purchase unit to consumption unit',
  })
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 4,
    default: 1,
    name: 'conversion_factor',
  })
  conversion_factor: number;

  @ApiPropertyOptional({
    example: 12.5,
    description: 'Cost per unit (dynamically or manually maintained)',
  })
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
    name: 'cost_per_unit',
  })
  cost_per_unit?: number | null;

  @ApiPropertyOptional({ required: false })
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @ApiProperty({ example: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => SupplySupplier, (ss) => ss.supply, { cascade: false })
  suppliers: SupplySupplier[];
}
