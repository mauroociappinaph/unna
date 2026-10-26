import { NotFoundError, Order } from '@unna/domain';
import { CAFE, MEDIALUNA, MILK, NOW, OAT, PreorderWorld, SLUG } from './preorder-fakes';

const CART = {
  customerName: 'Ana María López',
  items: [
    { productId: CAFE, quantity: 2, modifiers: [{ modifierGroupId: MILK, optionId: OAT }] },
    { productId: MEDIALUNA, quantity: 1 },
  ],
};
const LATER = new Date(NOW.getTime() + 60_000);

describe('OrderTrackingUseCase: tracking page of a pedido anticipado (S20)', () => {
  let world: PreorderWorld;

  const placed = async (cart = CART) => {
    const built = world.build();
    const { trackingToken } = (await built.checkout.create(SLUG, cart, NOW)).value!;
    const checkout = [...world.checkouts.rows.values()].find((c) => c.customerName === cart.customerName.trim())!;
    return { ...built, trackingToken, mpOrderId: checkout.mpOrderId! };
  };
  const orderOf = () => [...world.orders.values()][0];
  const move = (order: Order, ...steps: Array<'confirm' | 'startPreparing' | 'markReady' | 'deliver'>) => {
    const moved = steps.reduce((o, step) => o[step](), order);
    world.orders.set(moved.id, moved);
  };

  beforeEach(() => {
    world = new PreorderWorld();
  });

  it('returns only the allowed fields while awaiting payment', async () => {
    const { tracking, trackingToken } = await placed();

    const result = await tracking.track(trackingToken, LATER);

    expect(result.value).toEqual({
      status: 'awaiting_payment',
      orderNumber: null,
      businessName: 'Café UNNA',
      customerFirstName: 'Ana',
      sucursalName: 'Palermo',
      total: 350900,
      items: [{ name: 'Café con leche', quantity: 2 }, { name: 'Medialuna', quantity: 1 }],
      estimatedMinutes: null,
      updatedAt: expect.any(String),
    });
  });

  it('syncs with Mercado Pago while awaiting payment: once paid it shows the short order number and the estimate', async () => {
    const { tracking, trackingToken, mpOrderId } = await placed();
    world.mercadoPago.pay(mpOrderId);

    const result = await tracking.track(trackingToken, LATER);

    expect(world.orders.size).toBe(1);
    expect(result.value).toMatchObject({ status: 'received', orderNumber: orderOf().orderNumber.slice(-3), estimatedMinutes: 4, businessName: 'Café UNNA' });
    expect(JSON.stringify(result.value)).not.toContain(orderOf().id);
  });

  it('follows the order through the bar: preparing → ready → delivered', async () => {
    const { tracking, trackingToken, mpOrderId } = await placed();
    world.mercadoPago.pay(mpOrderId);
    await tracking.track(trackingToken, LATER);
    world.mercadoPago.getOrder.mockClear();

    move(orderOf(), 'confirm', 'startPreparing');
    expect((await tracking.track(trackingToken, LATER)).value).toMatchObject({ status: 'preparing', estimatedMinutes: 4 });
    move(orderOf(), 'markReady');
    expect((await tracking.track(trackingToken, LATER)).value).toMatchObject({ status: 'ready', estimatedMinutes: null });
    move(orderOf(), 'deliver');
    expect((await tracking.track(trackingToken, LATER)).value).toMatchObject({ status: 'delivered', estimatedMinutes: null });
    // A paid checkout is not read from Mercado Pago again.
    expect(world.mercadoPago.getOrder).not.toHaveBeenCalled();
  });

  it('marks the checkout expired when read after 15 minutes without payment', async () => {
    const { tracking, trackingToken } = await placed();

    const result = await tracking.track(trackingToken, new Date(NOW.getTime() + 15 * 60_000 + 1));

    expect(result.value).toMatchObject({ status: 'expired', orderNumber: null, estimatedMinutes: null });
    expect([...world.checkouts.rows.values()][0].status).toBe('expired');
  });

  it('shows a failed payment', async () => {
    const { tracking, trackingToken, mpOrderId } = await placed();
    world.mercadoPago.set(mpOrderId, 'failed');

    expect((await tracking.track(trackingToken, LATER)).value).toMatchObject({ status: 'payment_failed' });
  });

  it('keeps the stored status when Mercado Pago cannot be read', async () => {
    const { tracking, trackingToken } = await placed();
    world.mercadoPago.getOrder.mockRejectedValueOnce(new Error('Mercado Pago respondió 500'));

    expect((await tracking.track(trackingToken, LATER)).value).toMatchObject({ status: 'awaiting_payment' });
  });

  it("never shows another customer's checkout", async () => {
    const ana = await placed();
    const bruno = await placed({ ...CART, customerName: 'Bruno Díaz' });

    const anaView = (await ana.tracking.track(ana.trackingToken, LATER)).value!;
    const brunoView = (await bruno.tracking.track(bruno.trackingToken, LATER)).value!;

    expect(anaView.customerFirstName).toBe('Ana');
    expect(brunoView.customerFirstName).toBe('Bruno');
    expect(JSON.stringify(anaView)).not.toContain('Bruno');
  });

  it.each([
    ['an unknown token', 'A'.repeat(43)],
    ['a malformed token', 'not-a-token'],
  ])('answers 404 "Pedido no encontrado" for %s', async (_case, token) => {
    await placed();

    const result = await world.build().tracking.track(token, LATER);

    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(result.error!.message).toBe('Pedido no encontrado');
  });
});
