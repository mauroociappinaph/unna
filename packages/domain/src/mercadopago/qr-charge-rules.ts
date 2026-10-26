import type { MercadoPagoOrderStatus } from './mercadopago-gateway.port';
import type { QrChargeStatus } from './qr-charge.port';

/** A QR order is payable for 15 minutes (Mercado Pago's `expiration_time`). */
export const QR_CHARGE_EXPIRATION = 'PT15M';
export const QR_CHARGE_TTL_MS = 15 * 60 * 1000;

/** A store + POS provisioning claim older than this is considered abandoned (crashed request). */
export const MERCADOPAGO_PROVISIONING_STALE_MS = 2 * 60 * 1000;

const EXTERNAL_REFERENCE_MAX = 64;

/**
 * `external_reference` of the QR order: the UNNA order and charge ids (no personal data), limited to
 * 64 chars of [A-Za-z0-9_-].
 */
export function qrChargeExternalReference(orderId: string, chargeId: string): string {
  const clean = (id: string) => id.replace(/[^A-Za-z0-9]/g, '');
  return `${clean(orderId)}-${clean(chargeId)}`.slice(0, EXTERNAL_REFERENCE_MAX);
}

/**
 * Status a pending charge moves to for the Mercado Pago order status; null keeps it pending. A
 * refunded order was paid and given back before UNNA saw it, so nothing is registered.
 */
export function qrChargeStatusFor(status: MercadoPagoOrderStatus): Exclude<QrChargeStatus, 'pending'> | null {
  switch (status) {
    case 'processed':
      return 'paid';
    case 'expired':
      return 'expired';
    case 'canceled':
    case 'refunded':
      return 'cancelled';
    default:
      return null;
  }
}
