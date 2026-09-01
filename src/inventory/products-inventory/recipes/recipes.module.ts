import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { ProductRecipe } from './entities/product-recipe.entity';
import { ProductRecipeLine } from './entities/product-recipe-line.entity';
import { Product } from '../products/entities/product.entity';
import { Variant } from '../variants/entities/variant.entity';
import { Modifier } from '../modifiers/entities/modifier.entity';
import { PurchaseOrderItem } from '../purchase-order-item/entities/purchase-order-item.entity';
import { Item } from '../stocks/items/entities/item.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { RecipesController } from './recipes.controller';
import { RecipesV1Controller } from './recipes-v1.controller';
import { RecipesService } from './recipes.service';
import { RecipeTheoreticalCostService } from './recipe-theoretical-cost.service';
import { Supply } from 'src/inventory/supplies/entities/supply.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ProductRecipe,
      ProductRecipeLine,
      Product,
      Variant,
      Modifier,
      PurchaseOrderItem,
      Item,
      Merchant,
      Supply,
    ]),
  ],
  controllers: [RecipesController, RecipesV1Controller],
  providers: [RecipesService, RecipeTheoreticalCostService],
  exports: [RecipesService, RecipeTheoreticalCostService],
})
export class RecipesModule {}
