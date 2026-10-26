import { NotFoundError, Order, qrChargeExternalReference } from '@unna/domain';
import { ACCESS_TOKEN, BUSINESS, newOrder, NOW, QrWorld } from './qr-charge-fakes';
import type { QrChargeView } from '../qr-charge.view';

const MINUTE = 60 * 1000;
const at = (minutes: number) => new Date(NOW.getTime() + minutes * MINUTE);

const setup = () => {
  const world = new QrWorld();
  const order = world.addOrder(newOrder());
  const { useCase, sync } = world.build();
  const create = (orderId = order.id, now = NOW) => useCase.create(BUSINESS, orderId, now);
  return { world, order, useCase, sync, create };
};

const created = async (pending: ReturnType<ReturnType<typeof setup>['create']>): Promise<QrChargeView> => {
  const result = await pending;
  if (!result.ok) throw result.error;
  return result.value!;
};

describe('QrChargeUseCase (S15)', () => {
  describe('create', () => {
    it('creates a hybrid QR order for the pending balance under the order lock and stores the pending charge', async () => {
      const { world, order, create } = setup();

      const charge = await created(create());

      expect(world.mercadoPago.createQrOrder).toHaveBeenCalledTimes(1);
      expect(world.mercadoPago.createQrOrder).toHaveBeenCalledWith(ACCESS_TOKEN, {
        externalReference: qrChargeExternalReference(order.id, charge.id),
        externalPosId: 'UNNAPsuc1',
        amount: 12345,
        description: `Pedido ${order.orderNumber}`,
        expirationTime: 'PT15M',
        idempotencyKey: charge.id,
      });
      expect(charge).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        orderId: order.id,
        amount: 12345,
        status: 'pending',
        qrData: '000201-QR-ORD01TEST',
        expiresAt: at(15).toISOString(),
        paidAt: null,
        paymentRegistered: false,
        paymentError: null,
      });
      expect(world.charges.charges.get(charge.id)).toMatchObject({
        businessId: BUSINESS, orderId: order.id, sucursalId: 'suc-1', status: 'pending', mpOrderId: 'ORD01TEST', paymentId: null, expiresAt: at(15),
      });
      expect(world.locks).toContainEqual([order.id, BUSINESS]);
    });

    it('charges only what is still pending after earlier payments', async () => {
      const { world, order, create } = setup();
      world.payments.push({ id: 'p1', orderId: order.id, businessId: BUSINESS, amount: 2345, method: 'cash', status: 'completed', createdAt: NOW });

      expect((await created(create())).amount).toBe(10000);
      expect(world.mercadoPago.createQrOrder.mock.calls[0][1].amount).toBe(10000);
    });

    it('returns the pending, unexpired charge instead of creating another one, also for concurrent requests', async () => {
      const { world, create } = setup();

      const [first, second] = await Promise.all([created(create()), created(create())]);
      const third = await created(create(undefined, at(14)));

      expect(second).toEqual(first);
      expect(third).toEqual(first);
      expect(world.mercadoPago.createQrOrder).toHaveBeenCalledTimes(1);
      expect(world.charges.charges.size).toBe(1);
    });

    it('settles an expired pending charge with Mercado Pago and creates a new one', async () => {
      const { world, create } = setup();
      const first = await created(create());
      world.mercadoPago.set('ORD01TEST', 'expired');

      const second = await created(create(undefined, at(16)));

      expect(second.id).not.toBe(first.id);
      expect(world.charges.charges.get(first.id)?.status).toBe('expired');
      expect(world.mercadoPago.createQrOrder).toHaveBeenCalledTimes(2);
    });

    const rejected: Array<[string, (world: QrWorld, order: Order) => string, string]> = [
      ['the order is already paid', (w, o) => w.addOrder(o.markPaymentCompleted('cash')).id, 'El pedido ya está pagado'],
      ['the order is cancelled', (w, o) => w.addOrder(o.cancel('se fue')).id, 'No se puede cobrar un pedido cancelado o reembolsado'],
      ['the business is not connected', (w, o) => { w.mpRepository.connections.delete(BUSINESS); return o.id; }, 'Conectá tu cuenta de Mercado Pago'],
      ['the sucursal has no POS', (w, o) => {
        w.mpRepository.sucursales = w.mpRepository.sucursales.map((s) => (s.id === 'suc-1' ? { ...s, mpPosId: null, mpPosExternalId: null } : s));
        return o.id;
      }, 'Activá el cobro QR en esta sucursal'],
      ['the caja is closed', (w, o) => { w.openCash.delete('suc-1'); return o.id; }, 'Abrí la caja para cobrar'],
    ];

    it.each(rejected)('rejects when %s, without calling Mercado Pago nor storing a charge', async (_case, arrange, message) => {
      const { world, order, create } = setup();
      const orderId = arrange(world, order);

      const result = await create(orderId);

      expect(result).toEqual({ ok: false, error: new Error(message) });
      expect(world.mercadoPago.createQrOrder).not.toHaveBeenCalled();
      expect(world.charges.charges.size).toBe(0);
    });

    it('answers 404 for an order of another business, without calling Mercado Pago', async () => {
      const { world, create } = setup();
      const foreign = world.addOrder(newOrder('biz-B'));

      const result = await create(foreign.id);

      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error?.message).toBe('Pedido no encontrado');
      expect(world.mercadoPago.createQrOrder).not.toHaveBeenCalled();
      expect(world.charges.charges.size).toBe(0);
    });
  });

  describe('get', () => {
    it('keeps the charge pending while Mercado Pago reports it created', async () => {
      const { useCase, create } = setup();
      const charge = await created(create());

      await expect(useCase.get(BUSINESS, charge.id, at(1))).resolves.toEqual({ ok: true, value: charge });
    });

    it('registers the payment once Mercado Pago reports the order processed', async () => {
      const { world, order, useCase, create } = setup();
      const charge = await created(create());
      world.mercadoPago.pay('ORD01TEST');

      const result = await useCase.get(BUSINESS, charge.id, at(2));

      expect(result.value).toEqual({ ...charge, status: 'paid', paidAt: at(2).toISOString(), paymentRegistered: true });
      expect(world.payments).toEqual([expect.objectContaining({
        orderId: order.id, businessId: BUSINESS, amount: 12345, method: 'mercado_pago', status: 'completed', reference: 'ORD01TEST', cashSessionId: 'cash-1',
      })]);
      expect(world.orders.get(order.id)).toMatchObject({ paymentStatus: 'completed', paymentMethod: 'mercado_pago', paymentReference: 'ORD01TEST' });
      expect(world.charges.charges.get(charge.id)).toMatchObject({ paymentId: world.payments[0].id, mpPaymentId: 'PAY-ORD01TEST', paymentError: null });
    });

    it.each([['expired', 'expired'], ['canceled', 'cancelled']] as const)('marks the charge %s → %s without a payment', async (mpStatus, status) => {
      const { world, useCase, create } = setup();
      const charge = await created(create());
      world.mercadoPago.set('ORD01TEST', mpStatus);

      expect((await useCase.get(BUSINESS, charge.id, at(3))).value).toMatchObject({ status, paidAt: null, paymentRegistered: false });
      expect(world.payments).toEqual([]);
    });

    it('returns the stored charge when Mercado Pago cannot be read', async () => {
      const { world, useCase, create } = setup();
      const charge = await created(create());
      world.mercadoPago.getOrder.mockRejectedValueOnce(new Error('No se pudo conectar con Mercado Pago'));

      await expect(useCase.get(BUSINESS, charge.id, at(1))).resolves.toEqual({ ok: true, value: charge });
    });

    it('does not ask Mercado Pago again for a finished charge', async () => {
      const { world, useCase, create } = setup();
      const charge = await created(create());
      world.mercadoPago.set('ORD01TEST', 'expired');
      await useCase.get(BUSINESS, charge.id, at(16));
      world.mercadoPago.getOrder.mockClear();

      expect((await useCase.get(BUSINESS, charge.id, at(17))).value?.status).toBe('expired');
      expect(world.mercadoPago.getOrder).not.toHaveBeenCalled();
    });

    it('answers 404 for a charge of another business, without calling Mercado Pago', async () => {
      const { world, useCase } = setup();
      const foreign = world.addOrder(newOrder('biz-B'));
      const other = await world.build().useCase.create('biz-B', foreign.id, NOW);
      world.mercadoPago.getOrder.mockClear();

      const result = await useCase.get(BUSINESS, other.value!.id);

      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error?.message).toBe('Cobro QR no encontrado');
      expect(world.mercadoPago.getOrder).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels the created order in Mercado Pago with a stable idempotency key and marks the charge cancelled', async () => {
      const { world, useCase, create } = setup();
      const charge = await created(create());

      const result = await useCase.cancel(BUSINESS, charge.id, at(1));

      expect(result.value).toMatchObject({ id: charge.id, status: 'cancelled', paymentRegistered: false });
      expect(world.mercadoPago.cancelOrder).toHaveBeenCalledWith(ACCESS_TOKEN, 'ORD01TEST', expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/));
      expect(world.payments).toEqual([]);
    });

    it('registers the payment and answers paid when the customer paid before the cancel', async () => {
      const { world, useCase, create } = setup();
      const charge = await created(create());
      world.mercadoPago.pay('ORD01TEST');

      const result = await useCase.cancel(BUSINESS, charge.id, at(1));

      expect(result.value).toMatchObject({ status: 'paid', paymentRegistered: true });
      expect(world.mercadoPago.cancelOrder).not.toHaveBeenCalled();
      expect(world.payments).toHaveLength(1);
    });

    it('registers the payment when Mercado Pago rejects the cancel because the order was just paid', async () => {
      const { world, useCase, create } = setup();
      const charge = await created(create());
      world.mercadoPago.cancelOrder.mockImplementationOnce(async () => {
        world.mercadoPago.pay('ORD01TEST');
        throw new Error('Mercado Pago respondió 409 (order_already_processed)');
      });

      expect((await useCase.cancel(BUSINESS, charge.id, at(1))).value).toMatchObject({ status: 'paid', paymentRegistered: true });
      expect(world.payments).toHaveLength(1);
    });

    it('keeps the charge pending and explains it when a payment is in progress', async () => {
      const { world, useCase, create } = setup();
      const charge = await created(create());
      world.mercadoPago.cancelOrder.mockRejectedValueOnce(new Error('Mercado Pago respondió 409 (instore_order_locked_error)'));

      const result = await useCase.cancel(BUSINESS, charge.id, at(1));

      expect(result).toEqual({ ok: false, error: new Error('No se pudo cancelar el cobro QR: hay un pago en curso. Probá de nuevo en unos segundos') });
      expect(world.charges.charges.get(charge.id)?.status).toBe('pending');
    });

    it('returns a finished charge as it is, without calling Mercado Pago', async () => {
      const { world, useCase, create } = setup();
      const charge = await created(create());
      await useCase.cancel(BUSINESS, charge.id, at(1));
      world.mercadoPago.getOrder.mockClear();
      world.mercadoPago.cancelOrder.mockClear();

      expect((await useCase.cancel(BUSINESS, charge.id, at(2))).value?.status).toBe('cancelled');
      expect(world.mercadoPago.getOrder).not.toHaveBeenCalled();
      expect(world.mercadoPago.cancelOrder).not.toHaveBeenCalled();
    });

    it('answers 404 for a charge of another business and cancels nothing', async () => {
      const { world, useCase } = setup();
      const foreign = world.addOrder(newOrder('biz-B'));
      const other = await world.build().useCase.create('biz-B', foreign.id, NOW);

      const result = await useCase.cancel(BUSINESS, other.value!.id);

      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(world.mercadoPago.cancelOrder).not.toHaveBeenCalled();
      expect(world.charges.charges.get(other.value!.id)?.status).toBe('pending');
    });
  });
});
