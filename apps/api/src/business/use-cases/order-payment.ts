import { LockedOrderRepositories, Money, NotFoundError, Order, PaymentRecord } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import type { PAYMENT_METHODS } from './sales.use-case';

export interface RegisteredPayment {
  payment: PaymentRecord;
  order: Order;
  /** Completed payments of the order, the new one last. */
  payments: PaymentRecord[];
  remaining: number;
}

const fail = <T>(message: string): UseCaseResult<T> => ({ ok: false, error: new Error(message) });

/** Why the order cannot take payments; null when it can. */
export function unpayableReason(order: Order): string | null {
  if (['cancelled', 'refunded'].includes(order.status)) return 'No se puede cobrar un pedido cancelado o reembolsado';
  if (order.paymentStatus === 'completed') return 'El pedido ya está pagado';
  return null;
}

/** Order total minus its completed payments, in cents. */
export function pendingBalance(order: Order, payments: PaymentRecord[]): number {
  return order.totalAmount.toCents() - payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Registers a payment of an order; must run inside SalesUnitOfWorkPort.withOrderLock with its
 * repositories. Concurrent payments queue up on the lock and each one sees the payments committed
 * before it, so the total cannot be exceeded. The cash session is read with a shared lock in the
 * same transaction, so it cannot be closed until this payment, linked to it, commits. Checks run
 * before any write: a failure writes nothing.
 */
export async function registerOrderPayment(
  { orders, payments, cashSessions }: LockedOrderRepositories,
  command: { businessId: string; orderId: string; amount: number; method: (typeof PAYMENT_METHODS)[number]; reference?: string },
): Promise<UseCaseResult<RegisteredPayment>> {
  const { method } = command;
  const order = await orders.findByIdAndBusinessId(command.orderId, command.businessId);
  if (!order) return { ok: false, error: new NotFoundError('Pedido no encontrado') };
  const unpayable = unpayableReason(order);
  if (unpayable) return fail(unpayable);
  const cashSession = await cashSessions.findOpenBySucursalForPayment(command.businessId, order.sucursalId);
  if (!cashSession) return fail('Abrí la caja para cobrar');

  const previous = (await payments.findByOrderId(order.id)).filter((p) => p.status === 'completed');
  const remaining = pendingBalance(order, previous);
  if (command.amount > remaining) {
    return fail(`El monto supera el saldo pendiente (${Money.fromCents(remaining).format()})`);
  }

  const now = new Date();
  const payment: PaymentRecord = {
    id: crypto.randomUUID(),
    orderId: order.id,
    businessId: command.businessId,
    amount: command.amount,
    method,
    status: 'completed',
    reference: command.reference,
    processedAt: now,
    cashSessionId: cashSession.id,
    createdAt: now,
  };
  await payments.save(payment);

  const all = [...previous, payment];
  const newRemaining = remaining - command.amount;
  let updated = order;
  if (newRemaining === 0) {
    const methods = new Set(all.map((p) => p.method));
    updated = order.markPaymentCompleted(methods.size === 1 ? method : 'split', command.reference);
    await orders.save(updated);
  }

  return { ok: true, value: { payment, order: updated, payments: all, remaining: newRemaining } };
}
