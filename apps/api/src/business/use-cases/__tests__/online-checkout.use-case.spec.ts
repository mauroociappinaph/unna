import { createHash } from 'crypto';
import { Money, NotFoundError, Product } from '@unna/domain';
import { CAFE, DRAFT, MEDIALUNA, MILK, NOW, OAT, PreorderWorld, SLUG } from './preorder-fakes';

const CART = {
  customerName: '  Ana María  ',
  items: [
    { productId: CAFE, quantity: 2, modifiers: [{ modifierGroupId: MILK, optionId: OAT }], notes: 'Bien caliente' },
    { productId: MEDIALUNA, quantity: 1 },
  ],
};
// (1000 + 200 avena) × 2 + 21% IVA = 2904; 500 + 21% = 605.
const TOTAL = 350900;

describe('OnlineCheckoutUseCase: checkout of the pedido anticipado (S20)', () => {
  const OLD_FRONTEND = process.env.FRONTEND_URL;
  let world: PreorderWorld;

  beforeEach(() => {
    process.env.FRONTEND_URL = 'https://unna.example.com';
    world = new PreorderWorld();
  });
  afterAll(() => {
    if (OLD_FRONTEND === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = OLD_FRONTEND;
  });

  it('prices the cart on the server, stores it awaiting payment and returns the Mercado Pago checkout URL', async () => {
    const { checkout } = world.build();

    const result = await checkout.create(SLUG, CART, NOW);

    expect(result.ok).toBe(true);
    const { trackingToken, checkoutUrl, total } = result.value!;
    expect(trackingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(total).toBe(TOTAL);
    expect(checkoutUrl).toBe('https://mp.example/checkout/ORD01ONLINE');

    const [stored] = [...world.checkouts.rows.values()];
    expect(stored).toMatchObject({
      businessId: 'biz-A', sucursalId: 'suc-1', sucursalName: 'Palermo', status: 'awaiting_payment', customerName: 'Ana María', total: TOTAL,
      mpOrderId: 'ORD01ONLINE', checkoutUrl, orderId: null, paymentId: null, expiresAt: new Date(NOW.getTime() + 15 * 60 * 1000),
    });
    // Only the hash of the tracking token is stored.
    expect(stored.trackingTokenHash).toBe(createHash('sha256').update(trackingToken).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(trackingToken);
    expect(stored.lines).toEqual([
      {
        productId: CAFE, productName: 'Café con leche', productSku: null, quantity: 2, unitPrice: 120000, totalPrice: 240000, taxRate: 21, taxAmount: 50400,
        notes: 'Bien caliente', modifiers: [{ modifierGroupId: MILK, optionId: OAT, name: 'Avena', priceDelta: 20000 }], preparationTimeMinutes: 4,
      },
      {
        productId: MEDIALUNA, productName: 'Medialuna', productSku: null, quantity: 1, unitPrice: 50000, totalPrice: 50000, taxRate: 21, taxAmount: 10500,
        notes: null, modifiers: [], preparationTimeMinutes: 2,
      },
    ]);
  });

  it('creates no UNNA order: nothing reaches the POS or the bar until the payment is approved', async () => {
    await world.build().checkout.create(SLUG, CART, NOW);

    expect(world.orders.size).toBe(0);
    expect(world.payments).toHaveLength(0);
  });

  it('asks Mercado Pago for an online order of the total, outside any transaction, with back URLs to the tracking page', async () => {
    const { checkout } = world.build();

    const { trackingToken } = (await checkout.create(SLUG, CART, NOW)).value!;

    expect(world.mercadoPago.createOnlineOrder).toHaveBeenCalledTimes(1);
    const [token, request] = world.mercadoPago.createOnlineOrder.mock.calls[0];
    const [stored] = [...world.checkouts.rows.values()];
    const tracking = `https://unna.example.com/pedido/seguimiento/${trackingToken}`;
    expect(token).toBe('APP_USR-access-1');
    expect(request).toEqual({
      externalReference: `UNNAPA${stored.id.replace(/-/g, '')}`,
      amount: TOTAL,
      items: [{ title: 'Café con leche', quantity: 2, unitPrice: 145200 }, { title: 'Medialuna', quantity: 1, unitPrice: 60500 }],
      expirationTime: 'PT15M',
      successUrl: tracking,
      failureUrl: tracking,
      pendingUrl: tracking,
      idempotencyKey: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/),
    });
    // Items always add up to the total, even when a line total does not split evenly per unit.
    expect(request.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)).toBe(TOTAL);
  });

  it('sends a line whose total does not split per unit as one item, so the items still add up to the total', async () => {
    world.products = world.products.map((p) =>
      p.id === MEDIALUNA ? Product.reconstitute({ ...p, basePrice: Money.fromCents(101) }) : p,
    );

    await world.build().checkout.create(SLUG, { customerName: 'Ana', items: [{ productId: MEDIALUNA, quantity: 3 }] }, NOW);

    // 1.01 × 3 = 3.03 + 21% (0.64) = 3.67, not divisible by 3.
    expect(world.mercadoPago.requests[0].items).toEqual([{ title: '3 × Medialuna', quantity: 1, unitPrice: 367 }]);
    expect(world.mercadoPago.requests[0].amount).toBe(367);
  });

  it('cancels the checkout and reports a Spanish error when Mercado Pago fails', async () => {
    world.mercadoPago.failNextCreate = true;

    const result = await world.build().checkout.create(SLUG, CART, NOW);

    expect(result.ok).toBe(false);
    expect(result.error!.message).toBe('No se pudo iniciar el pago con Mercado Pago. Probá de nuevo');
    expect([...world.checkouts.rows.values()].map((c) => c.status)).toEqual(['cancelled']);
  });

  describe('when the Mercado Pago order cannot be stored after creating it', () => {
    const failAttach = () =>
      jest.spyOn(world.checkouts, 'attachMercadoPagoOrder').mockRejectedValueOnce(new Error('Can\'t reach database server at db:5432'));

    it('cancels the Mercado Pago order and the checkout, so nobody pays an order UNNA cannot match', async () => {
      failAttach();

      const result = await world.build().checkout.create(SLUG, CART, NOW);

      expect(result.ok).toBe(false);
      expect(result.value).toBeUndefined();
      expect(result.error!.message).toBe('No se pudo iniciar el pago con Mercado Pago. Probá de nuevo');
      expect(world.mercadoPago.cancelOrder).toHaveBeenCalledTimes(1);
      const [token, mpOrderId, idempotencyKey] = world.mercadoPago.cancelOrder.mock.calls[0];
      expect(token).toBe('APP_USR-access-1');
      expect(mpOrderId).toBe('ORD01ONLINE');
      expect(idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(world.mercadoPago.orders.get('ORD01ONLINE')!.status).toBe('canceled');
      expect([...world.checkouts.rows.values()].map((c) => c.status)).toEqual(['cancelled']);
    });

    it('still answers the same Spanish error when cancelling in Mercado Pago also fails', async () => {
      failAttach();
      world.mercadoPago.failNextCancel = true;

      const result = await world.build().checkout.create(SLUG, CART, NOW);

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('No se pudo iniciar el pago con Mercado Pago. Probá de nuevo');
      expect(world.mercadoPago.cancelOrder).toHaveBeenCalledTimes(1);
      expect([...world.checkouts.rows.values()].map((c) => c.status)).toEqual(['cancelled']);
    });

    it('still answers the same Spanish error when cancelling the checkout also fails', async () => {
      failAttach();
      jest.spyOn(world.checkouts, 'update').mockRejectedValueOnce(new Error('db down'));

      const result = await world.build().checkout.create(SLUG, CART, NOW);

      expect(result.error!.message).toBe('No se pudo iniciar el pago con Mercado Pago. Probá de nuevo');
      expect(world.mercadoPago.cancelOrder).toHaveBeenCalledTimes(1);
    });
  });

  describe('rejects without storing anything nor calling Mercado Pago', () => {
    const rejects = async (cart: typeof CART | Record<string, unknown>, message: string) => {
      const result = await world.build().checkout.create(SLUG, cart as typeof CART, NOW);
      expect(result.ok).toBe(false);
      expect(result.error).not.toBeInstanceOf(NotFoundError);
      expect(result.error!.message).toBe(message);
      expect(world.checkouts.rows.size).toBe(0);
      expect(world.mercadoPago.createOnlineOrder).not.toHaveBeenCalled();
    };
    const line = (patch: object) => ({ customerName: 'Ana', items: [{ productId: MEDIALUNA, quantity: 1, ...patch }] });

    it.each([
      ['an unknown product', line({ productId: 'a0000000-0000-4000-8000-0000000000ff' })],
      ['a product not for sale', line({ productId: DRAFT })],
      ['a modifier that does not apply', line({ modifiers: [{ modifierGroupId: MILK, optionId: OAT }] })],
      ['an inactive option', { customerName: 'Ana', items: [{ productId: CAFE, quantity: 1, modifiers: [{ modifierGroupId: MILK, optionId: 'c-off' }] }] }],
    ])('%s: "Algún producto ya no está disponible"', async (_case, cart) => {
      await rejects(cart, 'Algún producto ya no está disponible');
    });

    it('a missing required option, with the catalog message', async () => {
      await rejects({ customerName: 'Ana', items: [{ productId: CAFE, quantity: 1 }] }, 'Elegí al menos 1 opción(es) de "Leche"');
    });

    it.each([0, 21, 1.5])('a quantity of %p (1 to 20)', async (quantity) => {
      await rejects(line({ quantity }), 'La cantidad de cada producto debe ser de 1 a 20');
    });

    it('an empty cart or more than 30 lines', async () => {
      await rejects({ customerName: 'Ana', items: [] }, 'El pedido debe tener de 1 a 30 productos');
      await rejects({ customerName: 'Ana', items: Array.from({ length: 31 }, () => ({ productId: MEDIALUNA, quantity: 1 })) }, 'El pedido debe tener de 1 a 30 productos');
    });

    it.each(['', '   ', 'x'.repeat(41)])('a customer name of %p (1 to 40 chars)', async (customerName) => {
      await rejects({ ...CART, customerName }, 'Ingresá tu nombre (hasta 40 caracteres)');
    });

    it.each([
      ['the sucursal closed', (w: PreorderWorld) => { w.local.isActive = false; }, 'El local no está recibiendo pedidos en este momento'],
      ['the caja closed', (w: PreorderWorld) => w.openCash.clear(), 'El local no está recibiendo pedidos en este momento'],
      ['Mercado Pago not connected', (w: PreorderWorld) => w.mpRepository.connections.clear(), 'El local no está recibiendo pedidos en este momento'],
    ])('with %s', async (_case, setup, message) => {
      setup(world);
      await rejects(CART, message);
    });

    it('outside the schedule', async () => {
      const result = await world.build().checkout.create(SLUG, CART, new Date('2026-10-25T15:00:00Z'));
      expect(result.error!.message).toBe('El local está cerrado en este momento');
      expect(world.checkouts.rows.size).toBe(0);
    });
  });

  it('answers the generic 404 for a disabled link', async () => {
    world.local.enabled = false;

    const result = await world.build().checkout.create(SLUG, CART, NOW);

    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(result.error!.message).toBe('Este local no recibe pedidos anticipados');
    expect(world.checkouts.rows.size).toBe(0);
  });
});
