import { Order } from '../order';
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
    status: 'pending',
    items: [{ ...item(), orderId: 'pending' }],
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
        Order.create({ businessId: 'b', sucursalId: 's', sucursalName: 'P', type: 'dine_in', status: 'pending', items: [] }),
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
