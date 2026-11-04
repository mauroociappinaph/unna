import type { CategoryType, ProductStatus, StockMovement, StockOutType } from '@/lib/api-types';

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  plato: 'Plato',
  bebida: 'Bebida',
  postre: 'Postre',
  extra: 'Extra',
  combo: 'Combo',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Borrador',
  active: 'Activo',
  archived: 'Archivado',
};

export const STOCK_OUT_TYPE_LABELS: Record<StockOutType, string> = {
  out: 'Salida',
  adjustment: 'Ajuste',
  waste: 'Merma',
  transfer: 'Transferencia',
  sale: 'Venta',
  return: 'Devolución',
};

export const STOCK_MOVEMENT_LABELS: Record<StockMovement['type'], string> = {
  in: 'Ingreso',
  ...STOCK_OUT_TYPE_LABELS,
};
