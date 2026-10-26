import { Money } from '@unna/domain';
import { BUSINESS, newOrder, NOW, QrWorld } from './qr-charge-fakes';

const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60 * 1000);

/** A world with one order of biz-A and its pending QR charge (Mercado Pago order ORD01TEST). */
const withPendingCharge = async () => {
  const world = new QrWorld();
  const order = world.addOrder(newOrder());
  const { useCase, sync } = world.build();
  const result = await useCase.create(BUSINESS, order.id, NOW);
  const chargeId = result.value!.id;
  return { world, order, useCase, sync, chargeId, charge: () => world.charges.charges.get(chargeId)! };
};

describe('QrChargeSync (S15)', () => {
  it('registers a single payment however many times the paid order is synced', async () => {
    const { world, sync, charge } = await withPendingCharge();
    world.mercadoPago.pay('ORD01TEST');

    await sync.syncByMpOrderId('ORD01TEST', at(1));
    await sync.syncByMpOrderId('ORD01TEST', at(2));
    await sync.apply(charge(), await world.mercadoPago.getOrder('', 'ORD01TEST'), at(3));

    expect(world.payments).toHaveLength(1);
    expect(charge()).toMatchObject({ status: 'paid', paidAt: at(1), paymentId: world.payments[0].id });
  });

  it('registers a single payment when the webhook, the POS polling and a cancel race', async () => {
    const { world, useCase, sync, chargeId } = await withPendingCharge();
    world.mercadoPago.pay('ORD01TEST');

    const [webhook, poll, cancel] = await Promise.all([
      sync.syncByMpOrderId('ORD01TEST', at(1)),
      useCase.get(BUSINESS, chargeId, at(1)),
      useCase.cancel(BUSINESS, chargeId, at(1)),
    ]);

    expect(world.payments).toHaveLength(1);
    expect([webhook?.status, poll.value?.status, cancel.value?.status]).toEqual(['paid', 'paid', 'paid']);
    expect(world.mercadoPago.cancelOrder).not.toHaveBeenCalled();
  });

  it('runs the sync under the lock of the charge order and business', async () => {
    const { world, order, sync } = await withPendingCharge();
    world.locks = [];
    world.mercadoPago.pay('ORD01TEST');

    await sync.syncByMpOrderId('ORD01TEST', at(1));

    expect(world.locks).toEqual([[order.id, BUSINESS]]);
  });

  it('keeps the money visible when the caja was closed between the charge and the payment', async () => {
    const { world, order, useCase, chargeId, charge } = await withPendingCharge();
    world.openCash.delete('suc-1');
    world.mercadoPago.pay('ORD01TEST');

    const result = await useCase.get(BUSINESS, chargeId, at(5));

    expect(result.value).toMatchObject({ status: 'paid', paidAt: at(5).toISOString(), paymentRegistered: false, paymentError: 'Abrí la caja para cobrar' });
    expect(charge()).toMatchObject({ status: 'paid', paymentId: null, mpPaymentId: 'PAY-ORD01TEST', paymentError: 'Abrí la caja para cobrar' });
    expect(world.payments).toEqual([]);
    expect(world.orders.get(order.id)?.paymentStatus).toBe('pending');
  });

  it('keeps the money visible when the amount no longer fits the pending balance', async () => {
    const { world, order, sync, charge } = await withPendingCharge();
    world.payments.push({ id: 'cash-p', orderId: order.id, businessId: BUSINESS, amount: 5000, method: 'cash', status: 'completed', cashSessionId: 'cash-1', createdAt: NOW });
    world.mercadoPago.pay('ORD01TEST');

    await sync.syncByMpOrderId('ORD01TEST', at(1));

    expect(charge()).toMatchObject({
      status: 'paid', paymentId: null, paymentError: `El monto supera el saldo pendiente (${Money.fromCents(7345).format()})`,
    });
    expect(world.payments.map((p) => p.id)).toEqual(['cash-p']);
  });

  it('does not register a payment when Mercado Pago charged a different amount', async () => {
    const { world, sync, charge } = await withPendingCharge();
    world.mercadoPago.pay('ORD01TEST');
    world.mercadoPago.set('ORD01TEST', 'processed', { totalAmount: 100 });

    await sync.syncByMpOrderId('ORD01TEST', at(1));

    expect(charge()).toMatchObject({ status: 'paid', paymentId: null, paymentError: 'El monto cobrado en Mercado Pago no coincide con el cobro QR' });
    expect(world.payments).toEqual([]);
  });

  it('ignores a Mercado Pago order that is not the one of the charge', async () => {
    const { world, sync, charge } = await withPendingCharge();

    const result = await sync.apply(charge(), { id: 'ORD-OTHER', status: 'processed', statusDetail: 'accredited', externalReference: null, totalAmount: 12345, paymentId: 'PAY', qrData: null }, at(1));

    expect(result.status).toBe('pending');
    expect(world.payments).toEqual([]);
  });

  it('returns null for an unknown Mercado Pago order without reading it', async () => {
    const { world, sync } = await withPendingCharge();

    await expect(sync.syncByMpOrderId('ORD-UNKNOWN')).resolves.toBeNull();
    expect(world.mercadoPago.getOrder).not.toHaveBeenCalled();
  });

  it('reads the order with the connection of the business that owns the charge', async () => {
    const world = new QrWorld();
    const connection = world.mpRepository.connections.get('biz-B')!;
    world.mpRepository.connections.set('biz-B', { ...connection, encryptedAccessToken: world.cipher.encrypt('APP_USR-access-B') });
    const order = world.addOrder(newOrder('biz-B'));
    const { useCase, sync } = world.build();
    await useCase.create('biz-B', order.id, NOW);
    world.mercadoPago.getOrder.mockClear();

    await sync.syncByMpOrderId('ORD01TEST', at(1));

    expect(world.mercadoPago.getOrder).toHaveBeenCalledWith('APP_USR-access-B', 'ORD01TEST');
  });
});
