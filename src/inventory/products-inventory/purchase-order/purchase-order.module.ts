import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';

import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderController } from './purchase-order.controller';
import { Merchant } from 'src/platform-saas/merchants/entities/merchant.entity';
import { Supplier } from '../../../core/business-partners/suppliers/entities/supplier.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseOrderItem } from '../purchase-order-item/entities/purchase-order-item.entity';
import { Location } from '../stocks/locations/entities/location.entity';
import { Item } from '../stocks/items/entities/item.entity';
import { MovementsModule } from '../stocks/movements/movements.module';
import { MovementsService } from '../stocks/movements/movements.service';
import { Supply } from 'src/inventory/supplies/entities/supply.entity';
import { Movement } from '../stocks/movements/entities/movement.entity';
import { StockAlertsModule } from '../../stock-alerts/stock-alerts.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      PurchaseOrder,
      PurchaseOrderItem,
      Merchant,
      Supplier,
      Location,
      Item,
      Supply,
      Movement,
    ]),
    MovementsModule,
    StockAlertsModule,
  ],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}
