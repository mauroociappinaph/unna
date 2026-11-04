import { CAFE, MEDIALUNA, MILK, NOW, OAT, PreorderWorld, SLUG } from './preorder-fakes';

const CART = {
  customerName: 'Ana María',
  items: [
    { productId: CAFE, quantity: 2, modifiers: [{ modifierGroupId: MILK, optionId: OAT }], notes: 'Bien caliente' },
    { productId: MEDIALUNA, quantity: 1 },
  ],
};
const TOTAL = 350900;
const LATER = new Date(NOW.getTime() + 60_000);

describe('OnlineCheckoutSync: the order is created once the payment is approved (S20)', () => {
  let world: PreorderWorld;

  const checkoutFor = async () => {
    const built = world.build();
    const { trackingToken } = (await built.checkout.create(SLUG, CART, NOW)).value!;
    const [checkout] = [...world.checkouts.rows.values()];
    return { ...built, trackingToken, checkout, mpOrderId: checkout.mpOrderId! };
  };

  beforeEach(() => {
    world = new PreorderWorld();
  });

  it('creates the pickup order with the snapshot prices and registers the Mercado Pago payment in the open caja', async () => {
    const { sync, mpOrderId, checkout } = await checkoutFor();
    world.mercadoPago.pay(mpOrderId);

    const synced = await sync.syncByMpOrderId(mpOrderId, LATER);

    expect(world.orders.size).toBe(1);
    const [order] = [...world.orders.values()];
    expect(order).toMatchObject({
      businessId: 'biz-A', sucursalId: 'suc-1', sucursalName: 'Palermo', type: 'pickup', status: 'pending', customerName: 'Ana María',
      paymentStatus: 'completed', paymentMethod: 'mercado_pago', paymentReference: mpOrderId,
    });
    expect(order.totalAmount.toCents()).toBe(TOTAL);
    expect(order.items.map((i) => [i.productName, i.quantity, i.unitPrice.toCents(), i.taxAmount.toCents(), i.notes, i.modifiers])).toEqual([
      ['Café con leche', 2, 120000, 50400, 'Bien caliente', [{ modifierGroupId: MILK, optionId: OAT, name: 'Avena', priceDelta: 20000 }]],
      ['Medialuna', 1, 50000, 10500, undefined, []],
    ]);
    expect(world.payments).toEqual([
      expect.objectContaining({ orderId: order.id, amount: TOTAL, method: 'mercado_pago', status: 'completed', reference: mpOrderId, cashSessionId: 'cash-1' }),
    ]);
    expect(synced).toMatchObject({ id: checkout.id, status: 'paid', orderId: order.id, paymentId: world.payments[0].id, paymentError: null, paidAt: LATER, mpPaymentId: `PAY-${mpOrderId}` });
  });

  it('uses the snapshot even if the catalog prices changed after the checkout', async () => {
    const { sync, mpOrderId } = await checkoutFor();
    world.products = [];
    world.mercadoPago.pay(mpOrderId);

    await sync.syncByMpOrderId(mpOrderId, LATER);

    expect([...world.orders.values()][0].totalAmount.toCents()).toBe(TOTAL);
  });

  it('creates exactly one order and one payment when the webhook and a tracking poll sync at the same time', async () => {
    const { sync, mpOrderId, tracking, trackingToken } = await checkoutFor();
    world.mercadoPago.pay(mpOrderId);

    await Promise.all([sync.syncByMpOrderId(mpOrderId, LATER), tracking.track(trackingToken, LATER), sync.syncByMpOrderId(mpOrderId, LATER)]);
    await sync.syncByMpOrderId(mpOrderId, LATER);

    expect(world.orders.size).toBe(1);
    expect(world.payments).toHaveLength(1);
  });

  it('never calls Mercado Pago while the checkout lock is held', async () => {
    const { sync, mpOrderId } = await checkoutFor();
    world.mercadoPago.pay(mpOrderId);

    await expect(sync.syncByMpOrderId(mpOrderId, LATER)).resolves.toMatchObject({ status: 'paid' });
    // The fake throws when called under the lock; every call here ran outside it.
    expect(world.mercadoPago.getOrder).toHaveBeenCalled();
  });

  it('keeps the money as paid but not registered when the caja was closed meanwhile; the order still exists', async () => {
    const { sync, mpOrderId } = await checkoutFor();
    world.openCash.clear();
    world.mercadoPago.pay(mpOrderId);

    const synced = await sync.syncByMpOrderId(mpOrderId, LATER);

    expect(world.orders.size).toBe(1);
    const [order] = [...world.orders.values()];
    expect(order).toMatchObject({ type: 'pickup', paymentStatus: 'pending', customerName: 'Ana María' });
    expect(world.payments).toHaveLength(0);
    expect(synced).toMatchObject({ status: 'paid', orderId: order.id, paymentId: null, paymentError: 'Abrí la caja para cobrar' });
  });

  it('does not register a payment when Mercado Pago charged another amount', async () => {
    const { sync, mpOrderId } = await checkoutFor();
    world.mercadoPago.pay(mpOrderId);
    world.mercadoPago.set(mpOrderId, 'processed', { totalAmount: 100 });

    const synced = await sync.syncByMpOrderId(mpOrderId, LATER);

    expect(world.payments).toHaveLength(0);
    expect(world.orders.size).toBe(1);
    expect(synced).toMatchObject({ status: 'paid', paymentId: null, paymentError: 'El monto cobrado en Mercado Pago no coincide con el pedido' });
  });

  it.each([
    ['failed', 'payment_failed', LATER],
    ['expired', 'expired', LATER],
    ['canceled', 'cancelled', LATER],
    ['canceled', 'expired', new Date(NOW.getTime() + 16 * 60_000)],
    ['created', 'expired', new Date(NOW.getTime() + 16 * 60_000)],
  ] as const)('a %s order leaves the checkout %s, without any order', async (mpStatus, status, now) => {
    const { sync, mpOrderId } = await checkoutFor();
    world.mercadoPago.set(mpOrderId, mpStatus);

    await expect(sync.syncByMpOrderId(mpOrderId, now)).resolves.toMatchObject({ status, orderId: null });
    expect(world.orders.size).toBe(0);
  });

  it('keeps an unpaid, unexpired checkout awaiting payment', async () => {
    const { sync, mpOrderId } = await checkoutFor();
    world.mercadoPago.set(mpOrderId, 'action_required');

    await expect(sync.syncByMpOrderId(mpOrderId, LATER)).resolves.toMatchObject({ status: 'awaiting_payment' });
  });

  it('still creates the order when the payment is approved after the checkout was marked expired', async () => {
    const { sync, mpOrderId } = await checkoutFor();
    await sync.syncByMpOrderId(mpOrderId, new Date(NOW.getTime() + 16 * 60_000));
    world.mercadoPago.pay(mpOrderId);

    await expect(sync.syncByMpOrderId(mpOrderId, new Date(NOW.getTime() + 17 * 60_000))).resolves.toMatchObject({ status: 'paid' });
    expect(world.orders.size).toBe(1);
    expect(world.payments).toHaveLength(1);
  });

  it('answers null for a Mercado Pago order that is not an online checkout, without asking Mercado Pago', async () => {
    const { sync } = world.build();

    await expect(sync.syncByMpOrderId('ORD-QR-CHARGE', LATER)).resolves.toBeNull();
    expect(world.mercadoPago.getOrder).not.toHaveBeenCalled();
  });

  it('retries with a new order number when the random one is taken', async () => {
    const { mpOrderId } = await checkoutFor();
    world.mercadoPago.pay(mpOrderId);
    const realSave = world.unitOfWork;
    let collisions = 1;
    world.unitOfWork = () => {
      const unitOfWork = realSave.call(world);
      return {
        withCheckoutLock: (id, work) => unitOfWork.withCheckoutLock(id, async (repositories) => work({
          ...repositories,
          orders: { ...repositories.orders, save: async (order) => {
            if (collisions-- > 0) throw Object.assign(new Error('Unique'), { code: 'P2002', meta: { target: ['businessId', 'orderNumber'] } });
            return repositories.orders.save(order);
          } },
        })),
      };
    };

    await expect(world.build().sync.syncByMpOrderId(mpOrderId, LATER)).resolves.toMatchObject({ status: 'paid' });
    expect(world.orders.size).toBe(1);
  });
});
