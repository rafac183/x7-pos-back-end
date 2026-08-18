import type { InventoryStockAlertType } from './constants/inventory-stock-alert-type.enum';

export const INVENTORY_STOCK_ALERT_EVENT = 'inventory.stock_alert' as const;

export type InventoryStockAlertPayload = {
  alertId: number;
  companyId: number;
  merchantId: number;
  stockItemId: number;
  productId: number | null;
  variantId: number | null;
  supplyId?: number | null;
  locationId: number;
  categoryId: number | null;
  alertType: InventoryStockAlertType;
  currentQty: number;
  minimumQty: number | null;
  productName: string;
  variantName: string;
  locationName: string;
};
