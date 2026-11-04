// Online checkouts of the pedido anticipado (S20): the cart with server prices, waiting for the
// Mercado Pago payment. The UNNA order is created only once the payment is approved.
import type { LockedOrderRepositories } from '../ports/repository.port';
import type { OrderStatus } from '../value-objects/order';

export type OnlineCheckoutStatus = 'awaiting_payment' | 'paid' | 'payment_failed' | 'expired' | 'cancelled';

/** received = paid, order pending or confirmed. */
export type PreorderTrackingStatus =
  | 'awaiting_payment'
  | 'payment_failed'
  | 'expired'
  | 'received'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

/** A priced cart line, as the order line it becomes. Amounts in integer cents. */
export interface OnlineCheckoutLine {
  productId: string;
  productName: string;
  productSku: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
  notes: string | null;
  modifiers: Array<{ modifierGroupId: string; optionId: string; name: string; priceDelta: number }>;
  preparationTimeMinutes: number | null;
}

export interface OnlineCheckoutRecord {
  id: string;
  businessId: string;
  sucursalId: string;
  /** Snapshot, like the order's sucursalName. */
  sucursalName: string;
  /** SHA-256 of the tracking token; the token itself is only returned on creation. */
  trackingTokenHash: string;
  status: OnlineCheckoutStatus;
  customerName: string;
  lines: OnlineCheckoutLine[];
  /** Integer cents, the total of the order it becomes. */
  total: number;
  /** Null until Mercado Pago created the online order. */
  mpOrderId: string | null;
  checkoutUrl: string | null;
  expiresAt: Date;
  paidAt: Date | null;
  /** The UNNA order, created once the payment is approved. */
  orderId: string | null;
  /** Null while unpaid or when the payment could not be registered (see paymentError). */
  paymentId: string | null;
  mpPaymentId: string | null;
  /** Why a paid checkout has no payment in UNNA (caja closed...): the owner registers or refunds it. */
  paymentError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What the tracking page needs of a checkout, its business and its order. */
export interface OnlineCheckoutTracking {
  checkout: OnlineCheckoutRecord;
  businessName: string;
  order: { orderNumber: string; status: OrderStatus; updatedAt: Date } | null;
}

export interface OnlineCheckoutRepositoryPort {
  create(checkout: OnlineCheckoutRecord): Promise<void>;
  findById(id: string): Promise<OnlineCheckoutRecord | null>;
  findByMpOrderId(mpOrderId: string): Promise<OnlineCheckoutRecord | null>;
  findTrackingByTokenHash(trackingTokenHash: string): Promise<OnlineCheckoutTracking | null>;
  /** Stores the Mercado Pago order of a checkout that has none yet. */
  attachMercadoPagoOrder(id: string, mpOrderId: string, checkoutUrl: string): Promise<void>;
  /** Writes status, order, payment and Mercado Pago payment fields. */
  update(checkout: OnlineCheckoutRecord): Promise<void>;
}

export interface OnlineCheckoutLockedRepositories extends LockedOrderRepositories {
  checkouts: OnlineCheckoutRepositoryPort;
}

export interface OnlineCheckoutUnitOfWorkPort {
  /**
   * Runs `work` in one short transaction holding a lock on the checkout, with the order, payment and
   * cash session repositories bound to it: the order, its payment and the paid checkout commit
   * together, once. Mercado Pago is never called inside (S18).
   */
  withCheckoutLock<T>(checkoutId: string, work: (repositories: OnlineCheckoutLockedRepositories) => Promise<T>): Promise<T>;
}
