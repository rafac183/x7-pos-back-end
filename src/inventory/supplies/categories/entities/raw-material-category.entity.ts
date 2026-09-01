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
import { Supply } from '../../entities/supply.entity';

@Entity('raw_material_categories')
@Index(['company_id', 'name'], { unique: true })
export class RawMaterialCategory {
  @ApiProperty({ example: 1, description: 'Category ID' })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1, description: 'Company identifier' })
  @Column({ type: 'int' })
  company_id: number;

  @ManyToOne(() => Company, { eager: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ApiProperty({ example: 'Dairy', description: 'Category name' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiPropertyOptional({
    example: 'Milk, cheese, butter and other dairy products',
    description: 'Category description',
  })
  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @ApiProperty({ example: true, description: 'Category active status' })
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Supply, (supply) => supply.category)
  supplies: Supply[];
}
