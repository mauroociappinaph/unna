// QR charges (S15): a Mercado Pago QR order for the pending balance of an order. The payment is
// registered once, from the order read from Mercado Pago, under the order lock.
import type { LockedOrderRepositories } from '../ports/repository.port';

export type QrChargeStatus = 'pending' | 'paid' | 'expired' | 'cancelled';

export interface QrChargeRecord {
  id: string;
  businessId: string;
  orderId: string;
  sucursalId: string;
  /** Integer cents. */
  amount: number;
  status: QrChargeStatus;
  mpOrderId: string;
  mpPaymentId: string | null;
  qrData: string;
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
  create(charge: QrChargeRecord): Promise<void>;
  /** Writes status, payment and Mercado Pago payment fields of the charge. */
  update(charge: QrChargeRecord): Promise<void>;
}

export interface QrChargeLockedRepositories extends LockedOrderRepositories {
  qrCharges: QrChargeRepositoryPort;
}

export interface QrChargeUnitOfWorkPort {
  /**
   * Same order lock as SalesUnitOfWorkPort.withOrderLock, with the QR charges bound to the same
   * transaction: a payment and the charge that records it commit together or not at all.
   */
  withOrderLock<T>(orderId: string, businessId: string, work: (repositories: QrChargeLockedRepositories) => Promise<T>): Promise<T>;
}
