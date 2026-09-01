//src/restaurant-operations/dining-system/floor-plan/entity/floor-plan.entity.ts
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Table } from 'src/restaurant-operations/dining-system/tables/entities/table.entity';
import { FloorZone } from 'src/restaurant-operations/dining-system/floor-zone/entity/floor-zone.entity';

@Entity({ name: 'floor_plan' })
export class FloorPlan {
  @ApiProperty({
    type: () => Merchant,
    example: 1,
    description: 'Identifier of the Merchant related',
  })
  @ManyToOne(() => Merchant, { eager: true })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant;

  @ApiProperty({
    example: 1,
    description: 'Unique identifier of the Floor Plan',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 'Main Floor Plan',
    description: 'Name of the Floor Plan',
  })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({
    example: 500,
    description: 'Width of the floor plan in pixels',
  })
  @Column({ type: 'int' })
  width: number;

  @ApiProperty({
    example: 300,
    description: 'Height of the floor plan in pixels',
  })
  @Column({ type: 'int' })
  height: number;

  // Guarda el polígono (contorno) de la sala en píxeles del lienzo, serializado como JSON dentro de
  // una columna `text`: así no dependemos del soporte de JSON nativo de cada motor de base de datos.
  // `null` significa "rectángulo completo width × height", que es como se comportaban los planos
  // creados antes de existir este campo; por eso es nullable y no tiene valor por defecto.
  @ApiProperty({
    required: false,
    nullable: true,
    example: '[{"x":0,"y":0},{"x":800,"y":0},{"x":800,"y":600},{"x":0,"y":600}]',
    description:
      'Room outline polygon serialized as JSON, in canvas pixels. Null means the full width × height rectangle.',
  })
  @Column({ type: 'text', nullable: true })
  outline: string | null;

  @ApiProperty({
    example: 'active',
    description: 'Status of the floor plan',
  })
  @Column({ type: 'varchar', length: 50 })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ApiProperty({
    type: () => [Table],
    example: 1,
    description: 'Identifier of the Table related (if applicable)',
  })
  @OneToMany(() => Table, (table) => table.floorPlan)
  tables: Table[];

  @ApiProperty({
    type: () => [FloorZone],
    example: 1,
    description: 'Identifier of the Floor Zone related (if applicable)',
  })
  @OneToMany(() => FloorZone, (floorZone) => floorZone.floorPlan)
  floorZones: FloorZone[];
}
