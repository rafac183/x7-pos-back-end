import { Module } from '@nestjs/common';
import { ProductsInventoryModule } from './products-inventory/products-inventory.module';
import { SuppliesModule } from './supplies/supplies.module';
import { SaleInventoryModule } from './sale-inventory/sale-inventory.module';
import { SupplierInvoiceInventoryModule } from './supplier-invoice-inventory/supplier-invoice-inventory.module';
import { StockAlertsModule } from './stock-alerts/stock-alerts.module';

@Module({
  imports: [
    ProductsInventoryModule,
    SuppliesModule,
    SaleInventoryModule,
    SupplierInvoiceInventoryModule,
    StockAlertsModule,
  ],
  exports: [
    SaleInventoryModule,
    SupplierInvoiceInventoryModule,
    StockAlertsModule,
  ],
})
export class InventoryModule {}
