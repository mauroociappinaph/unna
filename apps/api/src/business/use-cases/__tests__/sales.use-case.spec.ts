import { SalesUseCase } from '../sales.use-case';
import { Money, Order } from '@unna/domain';
import { fake } from './test-doubles';

const m = (cents: number) => Money.fromCents(cents);

type NewOrderLine = Parameters<Order['addItem']>[0];
const line: NewOrderLine = { productId: 'p', productName: 'X', quantity: 1, unitPrice: m(1000), totalPrice: m(1000), taxRate: 0, taxAmount: m(0), modifiers: [] };

// Order.create sets status and each item's orderId itself, though its signature still lists them.
const openOrder = () =>
  Order.create({
    businessId: 'biz-A', sucursalId: 'suc-1', sucursalName: 'Central', type: 'dine_in',
    items: [line],
  } as Parameters<typeof Order.create>[0]);

describe('SalesUseCase', () => {
  it('rejects cancelling an order that has a partial payment', async () => {
    let order = openOrder();
    const sales = new SalesUseCase(
      fake({ findByIdAndBusinessId: async () => order, save: async (o: Order) => { order = o; } }),
      fake({ findByOrderId: async () => [{ amount: 400, method: 'cash', status: 'completed' }] }),
      fake({}), fake({}), fake({}), fake({}),
    );

    const result = await sales.changeStatus({ businessId: 'biz-A', orderId: order.id, action: 'cancel', reason: 'cliente se fue' });

    expect(result.ok).toBe(false);
    expect(result.error!.message).toBe('El pedido tiene pagos registrados; corresponde un reembolso, no una cancelación');
    expect(order.status).toBe('pending');
  });

  it('retries with a new order number when the generated one already exists', async () => {
    const savedNumbers: string[] = [];
    const orders = {
      save: jest.fn(async (o: Order) => {
        savedNumbers.push(o.orderNumber);
        if (savedNumbers.length === 1) throw Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['businessId', 'orderNumber'] } });
      }),
    };
    const product = {
      id: 'p', name: 'Milanesa', sku: undefined, taxRate: 21, basePrice: m(1000), modifierGroupIds: [],
      canBeSold: () => true,
    };
    const sales = new SalesUseCase(
      fake(orders),
      fake({}),
      fake({}),
      fake({ findByIdAndBusinessId: async () => product }),
      fake({ findByIdAndBusinessId: async () => null }),
      fake({ findById: async () => ({ id: 'biz-A', sucursales: [{ id: 'suc-1', name: 'Central', isActive: true }] }) }),
    );

    const result = await sales.createOrder({ businessId: 'biz-A', sucursalId: 'suc-1', type: 'takeaway', items: [{ productId: 'p', quantity: 1 }] });

    expect(result.ok).toBe(true);
    expect(orders.save).toHaveBeenCalledTimes(2);
    expect(savedNumbers[0]).not.toBe(savedNumbers[1]);
    expect(result.value!.orderNumber).toBe(savedNumbers[1]);
  });
});
