import { MercadoPagoOrder, Money, OnlineCheckoutLockedRepositories, OnlineCheckoutRecord, Order } from '@unna/domain';
import { registerOrderPayment } from './order-payment';

const AMOUNT_MISMATCH = 'El monto cobrado en Mercado Pago no coincide con el pedido';

/** The pickup order of a checkout, with the snapshot prices (the catalog may have changed since). */
export function orderFromCheckout(checkout: OnlineCheckoutRecord): Order {
  return Order.create({
    businessId: checkout.businessId,
    sucursalId: checkout.sucursalId,
    sucursalName: checkout.sucursalName,
    type: 'pickup',
    customerName: checkout.customerName,
    items: checkout.lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      productSku: line.productSku ?? undefined,
      quantity: line.quantity,
      unitPrice: Money.fromCents(line.unitPrice),
      totalPrice: Money.fromCents(line.totalPrice),
      taxRate: line.taxRate,
      taxAmount: Money.fromCents(line.taxAmount),
      notes: line.notes ?? undefined,
      modifiers: line.modifiers,
    })),
  });
}

/**
 * Must run under the checkout lock (OnlineCheckoutUnitOfWorkPort) with a checkout not paid yet:
 * creates the order and registers the Mercado Pago payment in the open caja, in the same short
 * transaction, so the order reaches the bar already paid. The money is already in the café's
 * account: when the payment cannot be registered (caja closed meanwhile, another amount) the order
 * still exists and the checkout stays paid with the reason, like the QR (S15).
 */
export async function placePaidOrder(
  repositories: OnlineCheckoutLockedRepositories,
  checkout: OnlineCheckoutRecord,
  mpOrder: MercadoPagoOrder,
  now: Date,
): Promise<OnlineCheckoutRecord> {
  const order = orderFromCheckout(checkout);
  await repositories.orders.save(order);
  const paid: OnlineCheckoutRecord = { ...checkout, status: 'paid', paidAt: now, orderId: order.id, mpPaymentId: mpOrder.paymentId, updatedAt: now };
  if (mpOrder.totalAmount !== checkout.total) return save(repositories, { ...paid, paymentError: AMOUNT_MISMATCH });

  const registered = await registerOrderPayment(repositories, {
    businessId: checkout.businessId,
    orderId: order.id,
    amount: checkout.total,
    method: 'mercado_pago',
    reference: mpOrder.id,
  });
  if (!registered.ok) return save(repositories, { ...paid, paymentError: registered.error?.message ?? 'No se pudo registrar el pago' });
  return save(repositories, { ...paid, paymentId: registered.value!.payment.id, paymentError: null });
}

async function save(repositories: OnlineCheckoutLockedRepositories, checkout: OnlineCheckoutRecord): Promise<OnlineCheckoutRecord> {
  await repositories.checkouts.update(checkout);
  return checkout;
}
