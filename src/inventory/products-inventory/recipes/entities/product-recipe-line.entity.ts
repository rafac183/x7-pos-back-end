import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Product } from '../../products/entities/product.entity';
import { Variant } from '../../variants/entities/variant.entity';
import { Modifier } from '../../modifiers/entities/modifier.entity';
import { ProductRecipe } from './product-recipe.entity';
import { RecipeLineType } from '../constants/recipe-line-type.enum';
import { RecipeQuantityUnit } from '../constants/recipe-quantity-unit.enum';
import { Supply } from 'src/inventory/supplies/entities/supply.entity';

@Entity('product_recipe_line')
export class ProductRecipeLine {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1 })
  @Column({ type: 'int', name: 'recipe_id' })
  recipeId: number;

  @ManyToOne(() => ProductRecipe, (recipe) => recipe.lines, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'recipe_id' })
  recipe: ProductRecipe;

  @ApiProperty({ enum: RecipeLineType, default: RecipeLineType.REQUIRED })
  @Column({
    type: 'enum',
    enum: RecipeLineType,
    name: 'line_type',
    default: RecipeLineType.REQUIRED,
  })
  lineType: RecipeLineType;

  @ApiPropertyOptional({
    example: 3,
    description:
      'When lineType is MODIFIER or OPTIONAL with a modifier, the modifier that triggers this line.',
  })
  @Column({ type: 'int', name: 'modifier_id', nullable: true })
  modifierId: number | null;

  @ManyToOne(() => Modifier, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'modifier_id' })
  modifier: Modifier | null;

  @ApiPropertyOptional({ example: 5 })
  @Column({ type: 'int', name: 'supply_product_id', nullable: true })
  supplyProductId?: number | null;

  @ManyToOne(() => Product, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'supply_product_id' })
  supplyProduct?: Product | null;

  @ApiPropertyOptional({ example: 1 })
  @Column({ type: 'int', name: 'supply_variant_id', nullable: true })
  supplyVariantId?: number | null;

  @ManyToOne(() => Variant, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'supply_variant_id' })
  supplyVariant?: Variant | null;

  @ApiPropertyOptional({ example: 1, description: 'Raw Material (Supply) ID' })
  @Column({ type: 'int', name: 'raw_material_id', nullable: true })
  rawMaterialId?: number | null;

  @ManyToOne(() => Supply, { onDelete: 'CASCADE', onUpdate: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'raw_material_id' })
  rawMaterial?: Supply | null;

  @ApiPropertyOptional({ example: 150.0, description: 'Quantity required in consumption units' })
  @Column({ type: 'decimal', precision: 14, scale: 4, nullable: true })
  quantity?: string | null;

  @ApiPropertyOptional({ example: 'g', description: 'Unit of measure' })
  @Column({ type: 'varchar', length: 50, name: 'unit_of_measure', nullable: true })
  unitOfMeasure?: string | null;

  @ApiProperty({
    example: 2,
    description: 'Quantity consumed per one sold unit of the finished good',
  })
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 4,
    name: 'quantity_per_sold_unit',
  })
  quantityPerSoldUnit: string;

  @ApiProperty({ enum: RecipeQuantityUnit, default: RecipeQuantityUnit.UNIT })
  @Column({
    type: 'enum',
    enum: RecipeQuantityUnit,
    name: 'quantity_unit',
    default: RecipeQuantityUnit.UNIT,
  })
  quantityUnit: RecipeQuantityUnit;
}
