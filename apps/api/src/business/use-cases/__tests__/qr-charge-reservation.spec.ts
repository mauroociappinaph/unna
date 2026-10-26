import { QrChargeRecord } from '@unna/domain';
import { BUSINESS, newOrder, NOW, QrWorld } from './qr-charge-fakes';

const MINUTE = 60 * 1000;
const at = (minutes: number) => new Date(NOW.getTime() + minutes * MINUTE);

const setup = () => {
  const world = new QrWorld();
  const order = world.addOrder(newOrder());
  const { useCase, sync } = world.build();
  const create = (now = NOW) => useCase.create(BUSINESS, order.id, now);
  return { world, order, useCase, sync, create };
};

/** A reservation left by another request (S18): no Mercado Pago order nor QR yet. */
const reservation = (orderId: string, createdAt: Date, patch: Partial<QrChargeRecord> = {}): QrChargeRecord => ({
  id: 'reserved-1', businessId: BUSINESS, orderId, sucursalId: 'suc-1', amount: 12345, status: 'creating', mpOrderId: null, mpPaymentId: null,
  qrData: null, expiresAt: new Date(createdAt.getTime() + 15 * MINUTE), paidAt: null, paymentId: null, paymentError: null, createdAt, ...patch,
});

/** Records, for every Mercado Pago call, whether the order lock was held at that moment. */
const recordLockDuringCalls = (world: QrWorld) => {
  const heldDuringCall: boolean[] = [];
  const spy = <A extends unknown[], R>(method: jest.Mock<Promise<R>, A>) => {
    const original = method.getMockImplementation()!;
    method.mockImplementation(async (...args: A) => {
      heldDuringCall.push(world.lockHeld);
      return original(...args);
    });
  };
  spy(world.mercadoPago.createQrOrder);
  spy(world.mercadoPago.getOrder);
  spy(world.mercadoPago.cancelOrder);
  return heldDuringCall;
};

describe('QrChargeUseCase.create outside the order lock (S18)', () => {
  it('reserves the charge under the lock, calls Mercado Pago without it and stores the order in a second short lock', async () => {
    const { world, order, create } = setup();
    const heldDuringCall = recordLockDuringCalls(world);

    const result = await create();

    expect(result.ok).toBe(true);
    expect(world.mercadoPago.createQrOrder).toHaveBeenCalledTimes(1);
    expect(heldDuringCall).toEqual([false]);
    expect(world.locks).toEqual([[order.id, BUSINESS], [order.id, BUSINESS]]);
    expect(world.charges.charges.get(result.value!.id)).toMatchObject({
      status: 'pending', mpOrderId: 'ORD01TEST', qrData: '000201-QR-ORD01TEST', expiresAt: at(15),
    });
  });

  it('gives concurrent creates one Mercado Pago order and the same charge', async () => {
    const { world, create } = setup();
    const heldDuringCall = recordLockDuringCalls(world);

    const results = await Promise.all([create(), create(), create()]);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(results.map((r) => r.value!.id)).size).toBe(1);
    expect(results.map((r) => r.value!.qrData)).toEqual(['000201-QR-ORD01TEST', '000201-QR-ORD01TEST', '000201-QR-ORD01TEST']);
    expect(world.mercadoPago.createQrOrder).toHaveBeenCalledTimes(1);
    expect(heldDuringCall).toEqual([false]);
    expect([...world.charges.charges.values()].map((c) => c.status)).toEqual(['pending']);
  });

  it('releases the reservation when Mercado Pago fails, so a retry creates the charge', async () => {
    const { world, create } = setup();
    world.mercadoPago.createQrOrder.mockRejectedValueOnce(new Error('No se pudo conectar con Mercado Pago'));

    await expect(create()).rejects.toThrow('No se pudo conectar con Mercado Pago');
    const [released] = [...world.charges.charges.values()];
    expect(released).toMatchObject({ status: 'cancelled', mpOrderId: null, qrData: null });

    const retry = await create();

    expect(retry.ok).toBe(true);
    expect(retry.value).toMatchObject({ status: 'pending', qrData: '000201-QR-ORD01TEST' });
    expect(retry.value!.id).not.toBe(released.id);
    expect(world.mercadoPago.createQrOrder).toHaveBeenCalledTimes(2);
    expect(world.mercadoPago.createQrOrder.mock.calls[1][1].idempotencyKey).toBe(retry.value!.id);
  });

  it('releases the reservation when Mercado Pago returns no QR', async () => {
    const { world, create } = setup();
    const original = world.mercadoPago.createQrOrder.getMockImplementation()!;
    world.mercadoPago.createQrOrder.mockImplementationOnce(async (...args) => ({ ...(await original(...args)), qrData: null }));

    expect(await create()).toEqual({ ok: false, error: new Error('Mercado Pago no devolvió el QR del cobro') });
    expect([...world.charges.charges.values()].map((c) => c.status)).toEqual(['cancelled']);
    expect((await create()).ok).toBe(true);
  });

  it('takes over a reservation abandoned more than 2 minutes ago', async () => {
    const { world, order, create } = setup();
    world.charges.charges.set('reserved-1', reservation(order.id, at(-3)));

    const result = await create();

    expect(result.ok).toBe(true);
    expect(result.value!.id).not.toBe('reserved-1');
    expect(world.charges.charges.get('reserved-1')?.status).toBe('cancelled');
    expect(world.mercadoPago.createQrOrder).toHaveBeenCalledTimes(1);
    expect(world.mercadoPago.createQrOrder.mock.calls[0][1].idempotencyKey).toBe(result.value!.id);
  });

  it('waits for a fresh reservation of another request and returns its charge, without calling Mercado Pago', async () => {
    const { world, order, create } = setup();
    world.charges.charges.set('reserved-1', reservation(order.id, at(-0.5)));
    setTimeout(() => {
      const reserved = world.charges.charges.get('reserved-1')!;
      world.charges.charges.set('reserved-1', { ...reserved, status: 'pending', mpOrderId: 'ORD-OTHER', qrData: 'QR-OTHER' });
    }, 50);

    const result = await create();

    expect(result.value).toMatchObject({ id: 'reserved-1', status: 'pending', qrData: 'QR-OTHER' });
    expect(world.mercadoPago.createQrOrder).not.toHaveBeenCalled();
  });

  it('gives up waiting for a reservation that never finishes, without taking it over', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const { world, order, create } = setup();
      world.charges.charges.set('reserved-1', reservation(order.id, at(-0.5)));

      const pending = create();
      await jest.advanceTimersByTimeAsync(25_000);

      expect(await pending).toEqual({ ok: false, error: new Error('Ya se está creando el cobro QR de este pedido. Probá de nuevo en unos segundos') });
      expect(world.mercadoPago.createQrOrder).not.toHaveBeenCalled();
      expect(world.charges.charges.get('reserved-1')?.status).toBe('creating');
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancels the Mercado Pago order when its reservation was taken over during the call', async () => {
    const { world, create } = setup();
    const original = world.mercadoPago.createQrOrder.getMockImplementation()!;
    world.mercadoPago.createQrOrder.mockImplementationOnce(async (...args) => {
      const [reserved] = [...world.charges.charges.values()];
      world.charges.charges.set(reserved.id, { ...reserved, status: 'cancelled' });
      return original(...args);
    });

    const result = await create();

    expect(result).toEqual({ ok: false, error: new Error('No se pudo crear el cobro QR. Probá de nuevo') });
    expect(world.mercadoPago.cancelOrder).toHaveBeenCalledWith(expect.any(String), 'ORD01TEST', expect.any(String));
    expect([...world.charges.charges.values()]).toEqual([expect.objectContaining({ status: 'cancelled', mpOrderId: null })]);
  });
});

describe('a charge still creating (S18)', () => {
  it('is returned as it is by get, cancel and sync, without asking Mercado Pago', async () => {
    const { world, order, useCase, sync } = setup();
    const creating = reservation(order.id, NOW);
    world.charges.charges.set(creating.id, creating);

    const got = await useCase.get(BUSINESS, creating.id, at(1));
    const cancelled = await useCase.cancel(BUSINESS, creating.id, at(1));
    const synced = await sync.sync(creating, at(1));

    expect(got.value).toMatchObject({ id: 'reserved-1', status: 'creating', qrData: null });
    expect(cancelled.value).toEqual(got.value);
    expect(synced).toEqual(creating);
    expect(world.mercadoPago.getOrder).not.toHaveBeenCalled();
    expect(world.mercadoPago.cancelOrder).not.toHaveBeenCalled();
    expect(world.payments).toEqual([]);
  });
});
