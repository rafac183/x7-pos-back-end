import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { MovementsService } from './movements.service';
import { MovementsController } from './movements.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movement } from './entities/movement.entity';
import { Item } from '../items/entities/item.entity';
import { ItemsModule } from '../items/items.module';
import { ProductRecipe } from '../../recipes/entities/product-recipe.entity';
import { Order } from 'src/restaurant-operations/pos/orders/entities/order.entity';
import { StockAlertsModule } from '../../../stock-alerts/stock-alerts.module';

@Module({
  imports: [
    AuthModule,
    StockAlertsModule,
    TypeOrmModule.forFeature([Movement, Item, ProductRecipe, Order]),
    forwardRef(() => ItemsModule),
  ],
  controllers: [MovementsController],
  providers: [MovementsService],
  exports: [MovementsService],
})
export class MovementsModule {}
