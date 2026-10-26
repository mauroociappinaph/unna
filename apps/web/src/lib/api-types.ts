// Response and request shapes of the catalog and sales API.
// They mirror real responses captured in src/__tests__/fixtures/api-shapes.json.
// Amounts are integer cents.

import type { PaymentMethod } from './api-types-sales';

// Orders, payments and receipts live in api-types-sales.ts; import them from here.
export * from './api-types-sales';

export interface Money {
  amount: number;
  currency: string;
}

/** Cursor page of a list: newest first; nextCursor comes from the X-Next-Cursor header and is null on the last page (S17). */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** limit defaults to 50 (max 200) in the API; cursor is the id of the last item received. */
export interface PageQuery {
  limit?: number;
  cursor?: string;
}

export const CATEGORY_TYPES = ['plato', 'bebida', 'postre', 'extra', 'combo'] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export interface Category {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  type: CategoryType;
  displayOrder: number;
  parentId?: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryInput {
  name: string;
  type: CategoryType;
  description?: string;
  displayOrder?: number;
  parentId?: string;
  isActive?: boolean;
}

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface ModifierGroup {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
  options: ModifierOption[];
  createdAt: string;
  updatedAt: string;
}

export interface ModifierOptionInput {
  name: string;
  priceDelta?: number;
  isDefault?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

export interface ModifierGroupInput {
  name: string;
  description?: string;
  minSelection?: number;
  maxSelection?: number;
  isRequired?: boolean;
  displayOrder?: number;
  options?: ModifierOptionInput[];
}

export const PRODUCT_TYPES = ['simple', 'composite', 'combo'] as const;
export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface Product {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  type: ProductType;
  status: ProductStatus;
  basePrice: Money;
  costPrice?: Money;
  taxRate: number;
  displayOrder: number;
  isActive: boolean;
  /** Pinned by the owner to the POS favorites strip. */
  isFavorite: boolean;
  images: string[];
  modifierGroupIds: string[];
  components: Array<{ productId: string; quantity: number }>;
  allergens: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  categoryId: string;
  name: string;
  type: ProductType;
  basePrice: number;
  status?: ProductStatus;
  description?: string;
  sku?: string;
  barcode?: string;
  costPrice?: number;
  taxRate?: number;
  displayOrder?: number;
  modifierGroupIds?: string[];
}

/** GET products/top-sellers: units sold in paid orders of the last days. */
export interface TopSeller {
  productId: string;
  name: string;
  quantity: number;
}

export interface StockLevel {
  productId: string;
  businessId: string;
  currentQuantity: number;
  reservedQuantity: number;
  minThreshold: number;
  maxThreshold?: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastMovementAt?: string;
  updatedAt: string;
}

export const STOCK_OUT_TYPES = ['out', 'adjustment', 'waste', 'transfer', 'sale', 'return'] as const;
export type StockOutType = (typeof STOCK_OUT_TYPES)[number];

export interface StockMovement {
  id: string;
  productId: string;
  businessId: string;
  type: 'in' | StockOutType;
  quantity: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface StockChange {
  level: StockLevel;
  movement: StockMovement;
}

/** Amounts in cents for every payment method. */
export type CashAmounts = Record<PaymentMethod, number>;

export const CASH_MOVEMENT_TYPES = ['in', 'out'] as const;
export type CashMovementType = (typeof CASH_MOVEMENT_TYPES)[number];

export interface CashMovement {
  id: string;
  sessionId: string;
  type: CashMovementType;
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface CashSession {
  id: string;
  businessId: string;
  sucursalId: string;
  status: 'open' | 'closed';
  openedBy: string;
  openedAt: string;
  /** Fondo inicial in cents. */
  openingAmount: number;
  movements: CashMovement[];
  closedBy?: string;
  closedAt?: string;
  notes?: string;
  /** Present once closed. */
  expected?: CashAmounts;
  declared?: CashAmounts;
  difference?: CashAmounts;
}

/** Cash session as the list returns it: no movements, only how many there are. */
export type CashSessionListItem = Omit<CashSession, 'movements'> & { movementCount: number };

export interface CashMovementInput {
  type: CashMovementType;
  amount: number;
  reason: string;
}

export interface CloseCashSessionInput {
  declared: CashAmounts;
  notes?: string;
}

/** Mercado Pago cash register of a sucursal; the QR URLs are its printed static QR. */
export interface MercadoPagoPos {
  sucursalId: string;
  ready: boolean;
  qrImageUrl: string | null;
  qrTemplateUrl: string | null;
}

export interface MercadoPagoStatus {
  connected: boolean;
  mpUserId: string | null;
  liveMode: boolean | null;
  connectedAt: string | null;
  sucursales: (MercadoPagoPos & { name: string })[];
}

/** `creating`: reserved while the API asks Mercado Pago for the QR (S18); it has no qrData yet. */
export type QrChargeStatus = 'creating' | 'pending' | 'paid' | 'expired' | 'cancelled';

/** Mercado Pago QR order for the pending balance of an order; amount in cents, qrData is the on-screen QR. */
export interface QrCharge {
  id: string;
  orderId: string;
  amount: number;
  status: QrChargeStatus;
  qrData: string | null;
  expiresAt: string;
  paidAt?: string | null;
  /** True while the API runs the Mercado Pago simulator: the POS may offer "Simular pago". */
  simulated?: boolean;
}

/** Formats integer cents as Argentine pesos, e.g. 150000 -> "$ 1.500,00". */
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100);
}
