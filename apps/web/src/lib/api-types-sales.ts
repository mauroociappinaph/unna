// Sales shapes (orders, payments, receipts), re-exported by api-types.ts.
// Amounts are integer cents.

import type { Money } from './api-types';

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

/** Order as listed by GET orders: without items, with how many it has (S17). The detail keeps the items. */
export type OrderSummary = Omit<Order, 'items'> & { itemCount: number };

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
