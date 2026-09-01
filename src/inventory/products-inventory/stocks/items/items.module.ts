import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './entities/item.entity';
import { MovementsModule } from '../movements/movements.module';
import { Product } from '../../products/entities/product.entity';
import { Variant } from '../../variants/entities/variant.entity';
import { Location } from '../locations/entities/location.entity';
import { StockAlertsModule } from '../../../stock-alerts/stock-alerts.module';
import { Supply } from 'src/inventory/supplies/entities/supply.entity';

@Module({
  imports: [
    AuthModule,
    StockAlertsModule,
    TypeOrmModule.forFeature([Item, Product, Location, Variant, Supply]),
    forwardRef(() => MovementsModule),
  ],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
