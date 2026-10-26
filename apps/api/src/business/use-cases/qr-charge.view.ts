import type { QrChargeRecord, QrChargeStatus } from '@unna/domain';

/** QR charge as the API returns it; amount in cents. */
export interface QrChargeView {
  id: string;
  orderId: string;
  amount: number;
  status: QrChargeStatus;
  qrData: string;
  expiresAt: string;
  paidAt: string | null;
  /** True once the payment is registered on the order (only for `paid`). */
  paymentRegistered: boolean;
  /** For a `paid` charge without payment: why it was not registered (the owner registers or refunds it). */
  paymentError: string | null;
}

export function toQrChargeView(charge: QrChargeRecord): QrChargeView {
  return {
    id: charge.id,
    orderId: charge.orderId,
    amount: charge.amount,
    status: charge.status,
    qrData: charge.qrData,
    expiresAt: charge.expiresAt.toISOString(),
    paidAt: charge.paidAt ? charge.paidAt.toISOString() : null,
    paymentRegistered: charge.paymentId !== null,
    paymentError: charge.paymentError,
  };
}
