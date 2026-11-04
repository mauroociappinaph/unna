import { randomUUID } from 'crypto';
import {
  NotFoundError,
  QR_CHARGE_RESERVATION_STALE_MS,
  QR_CHARGE_TTL_MS,
  QrChargeLockedRepositories,
  QrChargeRecord,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { pendingBalance, unpayableReason } from './order-payment';

const ORDER_NOT_FOUND = 'Pedido no encontrado';
const ALREADY_PAID = 'El pedido ya está pagado';

/** What the short reservation under the order lock found (S18). */
export type QrChargeReservation =
  /** A pending, unexpired charge of the order: it is returned instead of creating another one. */
  | { kind: 'ready'; charge: QrChargeRecord }
  /** Another request reserved the charge and is calling Mercado Pago: wait for it. */
  | { kind: 'busy'; chargeId: string }
  /** Reserved for this request, which calls Mercado Pago (idempotency key = charge id). */
  | { kind: 'reserved'; charge: QrChargeRecord; orderNumber: string }
  | { kind: 'rejected'; result: UseCaseResult<never> };

const rejected = (error: Error): QrChargeReservation => ({ kind: 'rejected', result: { ok: false, error } });

/**
 * Step 1 of creating a charge, under the order lock: validates the order and its pending balance
 * and reserves the charge (`creating`), so concurrent requests reuse one charge and only one of
 * them calls Mercado Pago. A reservation older than QR_CHARGE_RESERVATION_STALE_MS belongs to a
 * crashed request: it is cancelled and a new one is reserved.
 */
export async function reserveQrCharge(
  { orders, payments, qrCharges }: QrChargeLockedRepositories,
  businessId: string,
  orderId: string,
  now: Date,
): Promise<QrChargeReservation> {
  const reusable = (await qrCharges.findPendingByOrder(businessId, orderId)).find((c) => c.expiresAt > now);
  if (reusable) return { kind: 'ready', charge: reusable };

  const order = await orders.findByIdAndBusinessId(orderId, businessId);
  if (!order) return rejected(new NotFoundError(ORDER_NOT_FOUND));
  const reason = unpayableReason(order);
  if (reason) return rejected(new Error(reason));
  const amount = pendingBalance(order, await payments.findByOrderId(orderId));
  if (amount <= 0) return rejected(new Error(ALREADY_PAID));

  const creating = await qrCharges.findCreatingByOrder(businessId, orderId);
  if (creating && creating.createdAt.getTime() > now.getTime() - QR_CHARGE_RESERVATION_STALE_MS) {
    return { kind: 'busy', chargeId: creating.id };
  }
  if (creating) await qrCharges.update({ ...creating, status: 'cancelled' });

  const charge: QrChargeRecord = {
    id: randomUUID(), businessId, orderId, sucursalId: order.sucursalId, amount, status: 'creating', mpOrderId: null, mpPaymentId: null,
    qrData: null, expiresAt: new Date(now.getTime() + QR_CHARGE_TTL_MS), paidAt: null, paymentId: null, paymentError: null, createdAt: now,
  };
  await qrCharges.create(charge);
  return { kind: 'reserved', charge, orderNumber: order.orderNumber };
}

/**
 * Step 3, under the order lock: stores the Mercado Pago order of the reservation, which becomes
 * pending. Null when the reservation is no longer `creating` (taken over as abandoned).
 */
export async function completeQrCharge(
  { qrCharges }: QrChargeLockedRepositories,
  reserved: QrChargeRecord,
  mpOrder: { id: string; qrData: string },
  now: Date,
): Promise<QrChargeRecord | null> {
  const current = await qrCharges.findById(reserved.businessId, reserved.id);
  if (current?.status !== 'creating') return null;
  const pending: QrChargeRecord = {
    ...current, status: 'pending', mpOrderId: mpOrder.id, qrData: mpOrder.qrData, expiresAt: new Date(now.getTime() + QR_CHARGE_TTL_MS),
  };
  await qrCharges.complete(pending);
  return pending;
}

/** Mercado Pago failed: the reservation is cancelled so the next create reserves a new one. */
export async function releaseQrCharge({ qrCharges }: QrChargeLockedRepositories, reserved: QrChargeRecord): Promise<void> {
  const current = await qrCharges.findById(reserved.businessId, reserved.id);
  if (current?.status === 'creating') await qrCharges.update({ ...current, status: 'cancelled' });
}
