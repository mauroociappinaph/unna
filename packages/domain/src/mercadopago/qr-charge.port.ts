// QR charges (S15): a Mercado Pago QR order for the pending balance of an order. The payment is
// registered once, from the order read from Mercado Pago, under the order lock.
import type { LockedOrderRepositories } from '../ports/repository.port';

/**
 * `creating`: reserved under the order lock while Mercado Pago creates its order, without the lock
 * (S18); it has no Mercado Pago order nor QR yet and becomes `pending` once they are stored.
 */
export type QrChargeStatus = 'creating' | 'pending' | 'paid' | 'expired' | 'cancelled';

export interface QrChargeRecord {
  id: string;
  businessId: string;
  orderId: string;
  sucursalId: string;
  /** Integer cents. */
  amount: number;
  status: QrChargeStatus;
  /** Null while `creating` (and for a reservation cancelled before Mercado Pago answered). */
  mpOrderId: string | null;
  mpPaymentId: string | null;
  /** EMVCo string of the on-screen QR; null while `creating`. */
  qrData: string | null;
  expiresAt: Date;
  paidAt: Date | null;
  /** Payment registered for the charge; null while unpaid or when it could not be registered. */
  paymentId: string | null;
  /**
   * Why a charge paid in Mercado Pago has no payment in UNNA (caja closed, balance exceeded, order
   * cancelled...). The money is in the seller's account: the owner registers or refunds it by hand.
   */
  paymentError: string | null;
  createdAt: Date;
}

export interface QrChargeRepositoryPort {
  /** Null when the charge does not exist or belongs to another business. */
  findById(businessId: string, id: string): Promise<QrChargeRecord | null>;
  findByMpOrderId(mpOrderId: string): Promise<QrChargeRecord | null>;
  findPendingByOrder(businessId: string, orderId: string): Promise<QrChargeRecord[]>;
  /** The reservation of the order while Mercado Pago creates its order; at most one, kept by the order lock. */
  findCreatingByOrder(businessId: string, orderId: string): Promise<QrChargeRecord | null>;
  create(charge: QrChargeRecord): Promise<void>;
  /** Writes status, payment and Mercado Pago payment fields of the charge. */
  update(charge: QrChargeRecord): Promise<void>;
  /** Stores the Mercado Pago order of a reservation: status, order id, QR and expiration. */
  complete(charge: QrChargeRecord): Promise<void>;
}

export interface QrChargeLockedRepositories extends LockedOrderRepositories {
  qrCharges: QrChargeRepositoryPort;
}

export interface QrChargeUnitOfWorkPort {
  /**
   * Same order lock as SalesUnitOfWorkPort.withOrderLock, with the QR charges bound to the same
   * transaction: a payment and the charge that records it commit together or not at all. The work
   * must stay short: Mercado Pago is never called while the lock is held (S18).
   */
  withOrderLock<T>(orderId: string, businessId: string, work: (repositories: QrChargeLockedRepositories) => Promise<T>): Promise<T>;
}
