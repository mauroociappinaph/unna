import type { MercadoPagoOrderStatus } from '../mercadopago/mercadopago-gateway.port';
import type { OrderStatus } from '../value-objects/order';
import type { OnlineCheckoutStatus, PreorderTrackingStatus } from './online-checkout.port';

// Pedido anticipado (S20): the customer pays online before UNNA creates the order.

/** A checkout is payable for 15 minutes (Mercado Pago's `expiration_time`). */
export const PREORDER_CHECKOUT_EXPIRATION = 'PT15M';
export const PREORDER_CHECKOUT_TTL_MS = 15 * 60 * 1000;

export const PREORDER_MAX_LINES = 30;
export const PREORDER_MAX_QUANTITY = 20;
export const PREORDER_CUSTOMER_NAME_MAX = 40;
/** Estimated minutes when no item has a preparation time. */
export const DEFAULT_PREPARATION_MINUTES = 10;

export const PREORDER_CLOSED = 'El local está cerrado en este momento';
export const PREORDER_NOT_RECEIVING = 'El local no está recibiendo pedidos en este momento';

// Slugs are 16 random bytes in base64url (22 chars); tracking tokens 32 bytes (43 chars).
const SLUG_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const TRACKING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const EXTERNAL_REFERENCE_MAX = 64;

export function isWellFormedPreorderSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

export function isWellFormedTrackingToken(token: string): boolean {
  return TRACKING_TOKEN_PATTERN.test(token);
}

/** `external_reference` of the online order: the checkout id (no personal data), ≤64 chars of [A-Za-z0-9_-]. */
export function onlineCheckoutExternalReference(checkoutId: string): string {
  return `UNNAPA${checkoutId.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, EXTERNAL_REFERENCE_MAX);
}

export interface PreorderConditions {
  /** The sucursal (and its business) is active. */
  active: boolean;
  /** Open now according to the sucursal schedule (Argentina time). */
  open: boolean;
  cashOpen: boolean;
  mercadoPagoConnected: boolean;
}

/** Why the local does not take orders now; null when it does. */
export function preorderNotAcceptingReason(conditions: PreorderConditions): string | null {
  if (!conditions.active) return PREORDER_NOT_RECEIVING;
  if (!conditions.open) return PREORDER_CLOSED;
  if (!conditions.cashOpen || !conditions.mercadoPagoConnected) return PREORDER_NOT_RECEIVING;
  return null;
}

/**
 * Status an unpaid checkout moves to for its Mercado Pago order; null keeps it awaiting payment.
 * Only `processed` is paid. Mercado Pago also cancels expired online orders, so a cancellation
 * after the checkout's expiry counts as expired; a payment still in progress at expiry too.
 */
export function onlineCheckoutStatusFor(status: MercadoPagoOrderStatus, expired: boolean): OnlineCheckoutStatus | null {
  switch (status) {
    case 'processed':
      return 'paid';
    case 'failed':
      return 'payment_failed';
    case 'expired':
      return 'expired';
    case 'canceled':
      return expired ? 'expired' : 'cancelled';
    case 'refunded':
      return 'cancelled';
    default:
      return expired ? 'expired' : null;
  }
}

/** What the tracking page shows: the checkout until it is paid, then the order. */
export function preorderTrackingStatus(checkout: OnlineCheckoutStatus, order: OrderStatus | null): PreorderTrackingStatus {
  if (checkout !== 'paid') return checkout;
  switch (order) {
    case 'preparing':
    case 'ready':
    case 'delivered':
      return order;
    case 'cancelled':
    case 'refunded':
      return 'cancelled';
    default:
      return 'received';
  }
}

/** The longest preparation time of the items, or the default. */
export function estimatedPreparationMinutes(lines: Array<{ preparationTimeMinutes: number | null }>): number {
  const times = lines.map((l) => l.preparationTimeMinutes ?? 0).filter((t) => t > 0);
  return times.length > 0 ? Math.max(...times) : DEFAULT_PREPARATION_MINUTES;
}
