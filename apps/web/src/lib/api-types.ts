// Response and request shapes of the catalog and sales API.
// They mirror real responses captured in src/__tests__/fixtures/api-shapes.json.
// Amounts are integer cents.

export interface Money {
  amount: number;
  currency: string;
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

export const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery', 'pickup'] as const;
export const ORDER_ACTIONS = ['confirm', 'prepare', 'ready', 'deliver', 'cancel'] as const;
export const PAYMENT_METHODS = ['cash', 'card', 'mercado_pago', 'transfer', 'qr'] as const;
export const RECEIPT_TYPES = ['ticket', 'A', 'B', 'C'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];
export type OrderAction = (typeof ORDER_ACTIONS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type ReceiptType = (typeof RECEIPT_TYPES)[number];
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';

export interface SelectedModifier {
  modifierGroupId: string;
  optionId: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  taxRate: number;
  taxAmount: Money;
  notes?: string;
  modifiers: Array<SelectedModifier & { name: string; priceDelta: number }>;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  businessId: string;
  sucursalId: string;
  sucursalName: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  tableNumber?: string;
  customerName?: string;
  notes?: string;
  items: OrderItem[];
  subtotal: Money;
  taxAmount: Money;
  discountAmount: Money;
  totalAmount: Money;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderLineInput {
  productId: string;
  quantity: number;
  notes?: string;
  modifiers?: SelectedModifier[];
}

export interface CreateOrderInput {
  sucursalId: string;
  type: OrderType;
  items: OrderLineInput[];
  tableNumber?: string;
  customerName?: string;
  notes?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  businessId: string;
  amount: number;
  method: PaymentMethod;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  reference?: string;
  processedAt?: string;
  createdAt: string;
}

export interface PaymentResult {
  order: Order;
  payments: Payment[];
  remaining: number;
}

export const IVA_CONDITIONS = ['responsable_inscripto', 'monotributo', 'exento', 'consumidor_final'] as const;
export type IvaCondition = (typeof IVA_CONDITIONS)[number];
export type ReceiptStatus = 'draft' | 'issued' | 'cancelled' | 'voided';

/** IVA of one rate: base and amount in cents. */
export interface IvaLine {
  rate: number;
  base: number;
  amount: number;
}

export interface Receipt {
  id: string;
  businessId: string;
  sucursalId: string;
  orderId: string;
  orderNumber: string;
  receiptNumber: string;
  /** Sequential number within (punto de venta, type); fiscal ones are the number ARCA authorized. */
  invoiceNumber?: number;
  pointOfSale: string;
  type: ReceiptType;
  receiptType: string;
  status: ReceiptStatus;
  subtotal: Money;
  taxAmount: Money;
  discountAmount: Money;
  totalAmount: Money;
  paymentMethod?: string;
  customerName?: string;
  customerTaxId?: string;
  customerCondition?: string;
  /** ARCA document of the customer: 80 CUIT, 96 DNI, 99 consumidor final. */
  docType?: number;
  docNumber?: string;
  cae?: string;
  caeExpiration?: string;
  ivaBreakdown: IvaLine[];
  netAmount?: Money;
  ivaAmount?: Money;
  /** ARCA verification URL encoded in the receipt QR. */
  qrCode?: string;
  authorizationError?: string;
  items: Array<Omit<OrderItem, 'orderId'> & { receiptId: string }>;
  issuedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueReceiptInput {
  type: ReceiptType;
  customerName?: string;
  customerTaxId?: string;
  customerCondition?: IvaCondition;
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

export type QrChargeStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

/** Mercado Pago QR order for the pending balance of an order; amount in cents, qrData is the on-screen QR. */
export interface QrCharge {
  id: string;
  orderId: string;
  amount: number;
  status: QrChargeStatus;
  qrData: string;
  expiresAt: string;
  paidAt?: string | null;
  /** True while the API runs the Mercado Pago simulator: the POS may offer "Simular pago". */
  simulated?: boolean;
}

/** Formats integer cents as Argentine pesos, e.g. 150000 -> "$ 1.500,00". */
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cents / 100);
}
