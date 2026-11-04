import { Order, OrderItem } from '../order';
import { Money } from '../money';

const item = (overrides: Partial<{ productId: string; quantity: number; unitCents: number; taxRate: number }> = {}) => {
  const quantity = overrides.quantity ?? 2;
  const unitPrice = Money.fromCents(overrides.unitCents ?? 1000);
  const taxRate = overrides.taxRate ?? 21;
  const totalPrice = unitPrice.multiply(quantity);
  return {
    productId: overrides.productId ?? 'prod-1',
    productName: 'Milanesa',
    quantity,
    unitPrice,
    totalPrice,
    taxRate,
    taxAmount: totalPrice.percentage(taxRate),
    modifiers: [],
  };
};

const newOrder = () =>
  Order.create({
    businessId: 'biz-1',
    sucursalId: 'suc-1',
    sucursalName: 'Palermo',
    type: 'dine_in',
    items: [item()],
  });

describe('Order', () => {
  describe('create', () => {
    it('computes subtotal, tax and total from items', () => {
      const order = newOrder();
      expect(order.subtotal.toCents()).toBe(2000);
      expect(order.taxAmount.toCents()).toBe(420);
      expect(order.totalAmount.toCents()).toBe(2420);
      expect(order.status).toBe('pending');
      expect(order.paymentStatus).toBe('pending');
    });

    it('links every item to the order id', () => {
      const order = newOrder();
      expect(order.items.every((i) => i.orderId === order.id)).toBe(true);
    });

    it('rejects an order without items', () => {
      expect(() =>
        Order.create({ businessId: 'b', sucursalId: 's', sucursalName: 'P', type: 'dine_in', items: [] }),
      ).toThrow('El pedido debe tener al menos un item');
    });
  });

  describe('items', () => {
    it('recalculates tax and total when an item is added', () => {
      const order = newOrder().addItem(item({ productId: 'prod-2', quantity: 1, unitCents: 500 }));
      expect(order.subtotal.toCents()).toBe(2500);
      expect(order.taxAmount.toCents()).toBe(525);
      expect(order.totalAmount.toCents()).toBe(3025);
    });

    it('recalculates tax and total when an item is removed', () => {
      const withTwo = newOrder().addItem(item({ productId: 'prod-2', quantity: 1, unitCents: 500 }));
      const order = withTwo.removeItem(withTwo.items[1].id);
      expect(order.taxAmount.toCents()).toBe(420);
      expect(order.totalAmount.toCents()).toBe(2420);
    });

    it('refuses to remove the last item', () => {
      const order = newOrder();
      expect(() => order.removeItem(order.items[0].id)).toThrow('El pedido debe tener al menos un item');
    });
  });

  describe('discount', () => {
    it('subtracts the discount from the total', () => {
      const order = newOrder().applyDiscount(Money.fromCents(400));
      expect(order.totalAmount.toCents()).toBe(2020);
    });

    it('rejects a discount larger than the subtotal', () => {
      expect(() => newOrder().applyDiscount(Money.fromCents(2001))).toThrow('El descuento no puede ser mayor al subtotal');
    });

    describe('keeps the discount within the subtotal when items change', () => {
      const LEFT_OVER = 'El descuento supera el subtotal. Ajustá el descuento antes de quitar productos.';
      const withItems = (lines: ReturnType<typeof item>[], discountCents: number) =>
        Order.create({ businessId: 'b', sucursalId: 's', sucursalName: 'P', type: 'dine_in', items: lines }).applyDiscount(Money.fromCents(discountCents));
      const snapshot = (o: Order) => ({ items: o.items.map((i) => [i.id, i.quantity]), subtotal: o.subtotal.toCents(), total: o.totalAmount.toCents(), discount: o.discountAmount.toCents() });

      it('rejects removing an item that leaves the discount above the subtotal, and the order stays unchanged', () => {
        const order = withItems([item({ quantity: 1, unitCents: 1000, taxRate: 0 }), item({ productId: 'prod-2', quantity: 1, unitCents: 100, taxRate: 0 })], 1000);
        const before = snapshot(order);

        expect(() => order.removeItem(order.items[0].id)).toThrow(LEFT_OVER);
        expect(snapshot(order)).toEqual(before);
        expect(before).toMatchObject({ subtotal: 1100, total: 100, discount: 1000 });
      });

      it('rejects it even when the IVA would keep the total positive (the receipt could never be issued)', () => {
        // 10.00 + 2.00 with 21% IVA and an 11.00 discount: without the 2.00 item, 10.00 + 2.10 - 11.00 = 1.10.
        const order = withItems([item({ quantity: 1, unitCents: 1000 }), item({ productId: 'prod-2', quantity: 1, unitCents: 200 })], 1100);
        const before = snapshot(order);

        expect(() => order.removeItem(order.items[1].id)).toThrow(LEFT_OVER);
        expect(snapshot(order)).toEqual(before);
      });

      it('rejects lowering a quantity that leaves the discount above the subtotal, and the order stays unchanged', () => {
        const order = withItems([item({ quantity: 3, unitCents: 1000, taxRate: 0 })], 2500);
        const before = snapshot(order);

        expect(() => order.updateItemQuantity(order.items[0].id, 2)).toThrow(LEFT_OVER);
        expect(snapshot(order)).toEqual(before);
        // Down to exactly the discount is still allowed.
        const lowered = order.applyDiscount(Money.fromCents(2000)).updateItemQuantity(order.items[0].id, 2);
        expect(lowered.totalAmount.toCents()).toBe(0);
      });

      it('still removes an item when the discount stays within the new subtotal', () => {
        const order = withItems([item({ quantity: 1, unitCents: 1000, taxRate: 0 }), item({ productId: 'prod-2', quantity: 1, unitCents: 100, taxRate: 0 })], 1000);
        const removed = order.removeItem(order.items[1].id);

        expect(removed.items.map((i) => i.id)).toEqual([order.items[0].id]);
        expect(removed.subtotal.toCents()).toBe(1000);
        expect(removed.discountAmount.toCents()).toBe(1000);
        expect(removed.totalAmount.toCents()).toBe(0);
      });
    });
  });

  describe('status lifecycle', () => {
    it('moves pending → confirmed → preparing → ready → delivered', () => {
      const delivered = newOrder().confirm().startPreparing().markReady().deliver();
      expect(delivered.status).toBe('delivered');
      expect(delivered.completedAt).toBeInstanceOf(Date);
    });

    it('rejects skipping a step', () => {
      expect(() => newOrder().markReady()).toThrow('Solo pedidos en preparación pueden marcarse como listos');
    });

    it('rejects cancelling a delivered order', () => {
      const delivered = newOrder().confirm().startPreparing().markReady().deliver();
      expect(() => delivered.cancel('error')).toThrow('No se puede cancelar un pedido en este estado');
    });

    it('records the cancellation reason', () => {
      const cancelled = newOrder().cancel('Cliente se fue');
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledReason).toBe('Cliente se fue');
    });
  });

  describe('payment', () => {
    it('marks payment completed once', () => {
      const paid = newOrder().markPaymentCompleted('cash');
      expect(paid.paymentStatus).toBe('completed');
      expect(paid.paymentMethod).toBe('cash');
      expect(() => paid.markPaymentCompleted('card')).toThrow('El pago ya está completado');
    });

    it('only refunds paid orders', () => {
      expect(() => newOrder().refund()).toThrow('Solo pedidos pagados pueden reembolsarse');
      const refunded = newOrder().markPaymentCompleted('card').refund();
      expect(refunded.status).toBe('refunded');
      expect(refunded.paymentStatus).toBe('refunded');
    });
  });
});

describe('OrderItem modifiers', () => {
  const item = () =>
    OrderItem.create({
      orderId: 'order-1', productId: 'p', productName: 'Milanesa', quantity: 2,
      unitPrice: Money.fromCents(150000), totalPrice: Money.fromCents(300000),
      taxRate: 21, taxAmount: Money.fromCents(63000), modifiers: [],
    });
  const sinGuarnicion = { modifierGroupId: 'grp', optionId: 'opt', name: 'Sin guarnición', priceDelta: -15050 };

  it('applies a negative option to unit and total price', () => {
    const withOption = item().addModifier(sinGuarnicion);

    expect(withOption.unitPrice.amount).toBe(134950);
    expect(withOption.totalPrice.amount).toBe(269900);
    expect(withOption.taxAmount.amount).toBe(56679);
  });

  it('restores the price when a negative option is removed', () => {
    const restored = item().addModifier(sinGuarnicion).removeModifier('opt');

    expect(restored.unitPrice.amount).toBe(150000);
    expect(restored.totalPrice.amount).toBe(300000);
    expect(restored.modifiers).toEqual([]);
  });

  it('rejects an option that makes the price negative', () => {
    expect(() => item().addModifier({ ...sinGuarnicion, priceDelta: -200000 })).toThrow('El precio con modificadores no puede ser negativo');
  });
});
