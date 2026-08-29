import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuppliesController } from './supplies.controller';
import { SuppliesService } from './supplies.service';
import { Supply } from './entities/supply.entity';
import { SupplySupplier } from './entities/supply-supplier.entity';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Supplier } from 'src/core/business-partners/suppliers/entities/supplier.entity';
import { RawMaterialCategory } from './categories/entities/raw-material-category.entity';
import { ProductRecipeLine } from 'src/inventory/products-inventory/recipes/entities/product-recipe-line.entity';
import { Movement } from 'src/inventory/products-inventory/stocks/movements/entities/movement.entity';
import { RawMaterialCategoriesController } from './categories/raw-material-categories.controller';
import { RawMaterialCategoriesService } from './categories/raw-material-categories.service';
import { RawMaterialStockController } from './raw-material-stock.controller';
import { InventoryJournalLinesController } from './inventory-journal-lines.controller';
import { Item } from '../products-inventory/stocks/items/entities/item.entity';
import { Location } from '../products-inventory/stocks/locations/entities/location.entity';
import { ItemsModule } from '../products-inventory/stocks/items/items.module';
import { LocationsModule } from '../products-inventory/stocks/locations/locations.module';
import { MovementsModule } from '../products-inventory/stocks/movements/movements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Supply,
      SupplySupplier,
      Merchant,
      Supplier,
      RawMaterialCategory,
      ProductRecipeLine,
      Movement,
      Item,
      Location,
    ]),
    ItemsModule,
    LocationsModule,
    MovementsModule,
  ],

  controllers: [
    SuppliesController,
    RawMaterialCategoriesController,
    RawMaterialStockController,
    InventoryJournalLinesController,
  ],
  providers: [SuppliesService, RawMaterialCategoriesService],
  exports: [SuppliesService, RawMaterialCategoriesService],
})
export class SuppliesModule {}
