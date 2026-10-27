import { SalesUseCase } from '../sales.use-case';
import { CashSessionRepositoryPort, LockedOrderRepositories, Money, Order, PaymentRecord, SalesUnitOfWorkPort } from '@unna/domain';
import { BadRequestException } from '@nestjs/common';
import { unwrap } from '../../../common/use-case-result';
import { fake } from './test-doubles';

const m = (cents: number) => Money.fromCents(cents);

type NewOrderLine = Parameters<Order['addItem']>[0];
const line: NewOrderLine = { productId: 'p', productName: 'X', quantity: 1, unitPrice: m(1000), totalPrice: m(1000), taxRate: 0, taxAmount: m(0), modifiers: [] };

const openOrder = () =>
  Order.create({ businessId: 'biz-A', sucursalId: 'suc-1', sucursalName: 'Central', type: 'dine_in', items: [line] });

/** Repositories that must not be reached: payments only touch the ones bound to the order lock. */
const outsideLock = () => {
  const refuse = async () => { throw new Error('repository used outside the order lock'); };
  return fake<never>({ findByIdAndBusinessId: refuse, findByOrderId: refuse, save: refuse });
};

type PaymentState = { order: Order; payments: PaymentRecord[]; cashSessionId?: string | null };

/** Runs each call after the previous one, like the row lock, over an in-memory order, its payments and the open cash session. */
const lockingUnitOfWork = (state: PaymentState) => {
  let held = false;
  let queue: Promise<unknown> = Promise.resolve();
  const guard = () => {
    if (!held) throw new Error('repository used outside the order lock');
  };
  const repositories: LockedOrderRepositories = {
    orders: fake({
      findByIdAndBusinessId: async (id: string, businessId: string) => {
        guard();
        return id === state.order.id && businessId === state.order.businessId ? state.order : null;
      },
      save: async (o: Order) => { guard(); state.order = o; },
    }),
    payments: fake({
      findByOrderId: async () => { guard(); return [...state.payments]; },
      save: async (p: PaymentRecord) => { guard(); state.payments.push(p); },
    }),
    cashSessions: {
      findOpenBySucursalForPayment: jest.fn(async () => {
        guard();
        const id = state.cashSessionId === undefined ? 'cash-1' : state.cashSessionId;
        return id ? { id } : null;
      }),
    },
  };
  const withOrderLock = jest.fn(<T>(_orderId: string, _businessId: string, work: (r: LockedOrderRepositories) => Promise<T>) => {
    const run = queue.then(async () => {
      held = true;
      try {
        return await work(repositories);
      } finally {
        held = false;
      }
    });
    queue = run.catch(() => undefined);
    return run;
  });
  return { unitOfWork: fake<SalesUnitOfWorkPort>({ withOrderLock }), withOrderLock, cashSessions: repositories.cashSessions };
};

const product = {
  id: 'p', name: 'Milanesa', sku: undefined, taxRate: 21, basePrice: m(1000), modifierGroupIds: [],
  canBeSold: () => true,
};

/** Cash sessions as createOrder sees them: one open session for suc-1 of biz-A. */
const openCash = () =>
  fake<CashSessionRepositoryPort>({
    findOpenBySucursal: jest.fn(async (businessId: string, sucursalId: string) =>
      businessId === 'biz-A' && sucursalId === 'suc-1' ? { id: 'cash-1' } : null),
  });

const paymentSales = (state: PaymentState) => {
  const { unitOfWork, withOrderLock, cashSessions } = lockingUnitOfWork(state);
  const sales = new SalesUseCase(
    outsideLock(),
    outsideLock(),
    fake({ findByIdAndBusinessId: async () => product }),
    fake({ findByIdAndBusinessId: async () => null }),
    fake({}),
    unitOfWork,
    outsideLock(),
  );
  return { sales, withOrderLock, cashSessions };
};

describe('SalesUseCase', () => {
  it('retries with a new order number when the generated one already exists', async () => {
    const savedNumbers: string[] = [];
    const orders = {
      save: jest.fn(async (o: Order) => {
        savedNumbers.push(o.orderNumber);
        if (savedNumbers.length === 1) throw Object.assign(new Error('Unique constraint'), { code: 'P2002', meta: { target: ['businessId', 'orderNumber'] } });
      }),
    };
    const sales = new SalesUseCase(
      fake(orders),
      fake({}),
      fake({ findByIdAndBusinessId: async () => product }),
      fake({ findByIdAndBusinessId: async () => null }),
      fake({ findById: async () => ({ id: 'biz-A', sucursales: [{ id: 'suc-1', name: 'Central', isActive: true }] }) }),
      fake({}),
      openCash(),
    );

    const result = await sales.createOrder({ businessId: 'biz-A', sucursalId: 'suc-1', type: 'takeaway', items: [{ productId: 'p', quantity: 1 }] });

    expect(result.ok).toBe(true);
    expect(orders.save).toHaveBeenCalledTimes(2);
    expect(savedNumbers[0]).not.toBe(savedNumbers[1]);
    expect(result.value!.orderNumber).toBe(savedNumbers[1]);
  });

  describe('modifier prices', () => {
    const option = (priceDelta: number) => ({ id: 'opt', name: 'Sin guarnición', priceDelta, isActive: true });
    const salesWith = (basePrice: number, priceDelta: number) => {
      const withGroup = { ...product, basePrice: m(basePrice), modifierGroupIds: ['grp'] };
      const group = { id: 'grp', name: 'Guarnición', isActive: true, isRequired: false, minSelection: 0, maxSelection: 1, options: [option(priceDelta)] };
      return new SalesUseCase(
        fake({ save: async () => undefined }),
        fake({}),
        fake({ findByIdAndBusinessId: async () => withGroup }),
        fake({ findByIdAndBusinessId: async () => group }),
        fake({ findById: async () => ({ id: 'biz-A', sucursales: [{ id: 'suc-1', name: 'Central', isActive: true }] }) }),
        fake({}),
        openCash(),
      );
    };
    const order = (sales: SalesUseCase) =>
      sales.createOrder({ businessId: 'biz-A', sucursalId: 'suc-1', type: 'takeaway', items: [{ productId: 'p', quantity: 2, modifiers: [{ modifierGroupId: 'grp', optionId: 'opt' }] }] });

    it('subtracts a negative option from the unit price', async () => {
      const result = await order(salesWith(150000, -15050));

      expect(result.ok).toBe(true);
      expect(result.value!.items[0].unitPrice.amount).toBe(134950);
      expect(result.value!.items[0].totalPrice.amount).toBe(269900);
    });

    it('rejects a line whose modifiers make the price negative', async () => {
      const result = await order(salesWith(1000, -5000));

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('El precio de "Milanesa" con sus modificadores no puede ser negativo');
    });
  });

  describe('registerPayment', () => {
    it('checks the balance and writes inside the order lock, so concurrent payments cannot overpay', async () => {
      const state = { order: openOrder(), payments: [] as PaymentRecord[] };
      const { sales, withOrderLock } = paymentSales(state);
      const pay = (amount: number) => sales.registerPayment({ businessId: 'biz-A', orderId: state.order.id, amount, method: 'cash' });

      const [first, second] = await Promise.all([pay(600), pay(600)]);

      expect(withOrderLock).toHaveBeenCalledTimes(2);
      expect(withOrderLock).toHaveBeenCalledWith(state.order.id, 'biz-A', expect.any(Function));
      expect(first.ok).toBe(true);
      expect(first.value!.remaining).toBe(400);
      expect(second.ok).toBe(false);
      expect(second.error!.message).toBe(`El monto supera el saldo pendiente (${Money.fromCents(400).format()})`);
      expect(state.payments.map((p) => p.amount)).toEqual([600]);
      expect(state.order.paymentStatus).toBe('pending');
    });

    it('marks the order paid with "split" once several methods cover the total', async () => {
      const state = { order: openOrder(), payments: [] as PaymentRecord[] };
      const { sales } = paymentSales(state);

      await sales.registerPayment({ businessId: 'biz-A', orderId: state.order.id, amount: 400, method: 'cash' });
      const result = await sales.registerPayment({ businessId: 'biz-A', orderId: state.order.id, amount: 600, method: 'card' });

      expect(result.ok).toBe(true);
      expect(result.value!.remaining).toBe(0);
      expect(result.value!.payments.map((p) => p.method)).toEqual(['cash', 'card']);
      expect(state.order.paymentStatus).toBe('completed');
      expect(state.order.paymentMethod).toBe('split');
    });

    it('rejects paying a cancelled order and writes nothing', async () => {
      const cancelled = openOrder().cancel('cliente se fue');
      const state = { order: cancelled, payments: [] as PaymentRecord[] };
      const { sales } = paymentSales(state);

      const result = await sales.registerPayment({ businessId: 'biz-A', orderId: cancelled.id, amount: 100, method: 'cash' });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('No se puede cobrar un pedido cancelado o reembolsado');
      expect(state.payments).toEqual([]);
      expect(state.order).toBe(cancelled);
    });

    it('rejects paying an order that is already paid and writes nothing', async () => {
      const paid = openOrder().markPaymentCompleted('cash');
      const state = { order: paid, payments: [] as PaymentRecord[] };
      const { sales } = paymentSales(state);

      const result = await sales.registerPayment({ businessId: 'biz-A', orderId: paid.id, amount: 100, method: 'cash' });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('El pedido ya está pagado');
      expect(state.payments).toEqual([]);
      expect(state.order).toBe(paid);
    });
  });

  describe('order changes under the order lock', () => {
    const twoItemOrder = () => openOrder().addItem(line);

    type Change = (sales: SalesUseCase, order: Order) => ReturnType<SalesUseCase['addItem']>;
    const changes: Array<[string, Change, string]> = [
      [
        'addItem',
        (sales, order) => sales.addItem({ businessId: 'biz-A', orderId: order.id, line: { productId: 'p', quantity: 1 } }),
        'El pedido tiene pagos registrados y ya no se puede modificar',
      ],
      [
        'removeItem',
        (sales, order) => sales.removeItem({ businessId: 'biz-A', orderId: order.id, itemId: order.items[0].id }),
        'El pedido tiene pagos registrados y ya no se puede modificar',
      ],
      [
        'applyDiscount',
        (sales, order) => sales.applyDiscount({ businessId: 'biz-A', orderId: order.id, amount: 100 }),
        'El pedido tiene pagos registrados y ya no se puede modificar',
      ],
      [
        'cancel',
        (sales, order) => sales.changeStatus({ businessId: 'biz-A', orderId: order.id, action: 'cancel', reason: 'cliente se fue' }),
        'El pedido tiene pagos registrados; corresponde un reembolso, no una cancelación',
      ],
    ];

    it.each(changes)('%s reads, checks and saves inside the order lock', async (_name, change) => {
      const state = { order: twoItemOrder(), payments: [] as PaymentRecord[] };
      const original = state.order;
      const { sales, withOrderLock } = paymentSales(state);

      const result = await change(sales, original);

      expect(result.ok).toBe(true);
      expect(withOrderLock).toHaveBeenCalledWith(original.id, 'biz-A', expect.any(Function));
      expect(state.order).toBe(result.value);
      expect(state.order).not.toBe(original);
    });

    it.each(changes)('%s is rejected and writes nothing when a payment completes first', async (_name, change, message) => {
      const state = { order: twoItemOrder(), payments: [] as PaymentRecord[] };
      const original = state.order;
      const { sales, withOrderLock } = paymentSales(state);

      const [payment, result] = await Promise.all([
        sales.registerPayment({ businessId: 'biz-A', orderId: original.id, amount: 400, method: 'cash' }),
        change(sales, original),
      ]);

      expect(payment.ok).toBe(true);
      expect(withOrderLock).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe(message);
      expect(state.order).toBe(original);
      expect(state.payments.map((p) => p.amount)).toEqual([400]);
    });

    it('rejects cancelling without a reason inside the lock and writes nothing', async () => {
      const state = { order: openOrder(), payments: [] as PaymentRecord[] };
      const original = state.order;
      const { sales } = paymentSales(state);

      const result = await sales.changeStatus({ businessId: 'biz-A', orderId: original.id, action: 'cancel', reason: '  ' });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('El motivo de cancelación es obligatorio');
      expect(state.order).toBe(original);
    });

    it('rejects cancelling a paid order with the refund message', async () => {
      const paid = openOrder().markPaymentCompleted('cash');
      const state = { order: paid, payments: [] as PaymentRecord[] };
      const { sales } = paymentSales(state);

      const result = await sales.changeStatus({ businessId: 'biz-A', orderId: paid.id, action: 'cancel', reason: 'cliente se fue' });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('El pedido ya está pagado; corresponde un reembolso, no una cancelación');
      expect(state.order).toBe(paid);
    });

    it('runs every other status change inside the order lock', async () => {
      const state = { order: openOrder(), payments: [] as PaymentRecord[] };
      const { sales, withOrderLock } = paymentSales(state);

      for (const action of ['confirm', 'prepare', 'ready', 'deliver']) {
        const result = await sales.changeStatus({ businessId: 'biz-A', orderId: state.order.id, action });
        expect(result.ok).toBe(true);
      }

      expect(withOrderLock).toHaveBeenCalledTimes(4);
      expect(state.order.status).toBe('delivered');
    });

    it('answers 400 and writes nothing when removing an item would leave the discount above the subtotal', async () => {
      const state = { order: twoItemOrder().applyDiscount(m(1500)), payments: [] as PaymentRecord[] };
      const original = state.order;
      const { sales } = paymentSales(state);

      const error = await unwrap(sales.removeItem({ businessId: 'biz-A', orderId: original.id, itemId: original.items[0].id })).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getStatus()).toBe(400);
      expect((error as BadRequestException).message).toBe('El descuento supera el subtotal. Ajustá el descuento antes de quitar productos.');
      expect(state.order).toBe(original);
    });

    it('reports a missing order or item with the not-found messages', async () => {
      const state = { order: twoItemOrder(), payments: [] as PaymentRecord[] };
      const original = state.order;
      const { sales } = paymentSales(state);

      const missingOrder = await sales.removeItem({ businessId: 'biz-A', orderId: 'nope', itemId: original.items[0].id });
      const missingItem = await sales.removeItem({ businessId: 'biz-A', orderId: original.id, itemId: 'nope' });

      expect(missingOrder.error!.message).toBe('Pedido no encontrado');
      expect(missingItem.error!.message).toBe('Item no encontrado');
      expect(state.order).toBe(original);
    });
  });

  describe('cash session (S12)', () => {
    const salesForOrders = (orders: { save: jest.Mock }, cashSessions: CashSessionRepositoryPort) =>
      new SalesUseCase(
        fake(orders),
        fake({}),
        fake({ findByIdAndBusinessId: async () => product }),
        fake({ findByIdAndBusinessId: async () => null }),
        fake({ findById: async () => ({ id: 'biz-A', sucursales: [{ id: 'suc-1', name: 'Central', isActive: true }, { id: 'suc-2', name: 'Norte', isActive: true }] }) }),
        fake({}),
        cashSessions,
      );

    it('creates an order only when the sucursal has an open cash session', async () => {
      const orders = { save: jest.fn(async () => undefined) };
      const cashSessions = openCash();

      const result = await salesForOrders(orders, cashSessions).createOrder({ businessId: 'biz-A', sucursalId: 'suc-1', type: 'takeaway', items: [{ productId: 'p', quantity: 1 }] });

      expect(result.ok).toBe(true);
      expect(cashSessions.findOpenBySucursal).toHaveBeenCalledWith('biz-A', 'suc-1');
      expect(orders.save).toHaveBeenCalledTimes(1);
    });

    it('rejects creating an order without an open cash session and writes nothing', async () => {
      const orders = { save: jest.fn(async () => undefined) };

      const result = await salesForOrders(orders, openCash()).createOrder({ businessId: 'biz-A', sucursalId: 'suc-2', type: 'takeaway', items: [{ productId: 'p', quantity: 1 }] });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('Abrí la caja para empezar a vender');
      expect(orders.save).not.toHaveBeenCalled();
    });

    it('links each payment to the open session of the order sucursal, looked up inside the order lock', async () => {
      const state: PaymentState = { order: openOrder(), payments: [], cashSessionId: 'cash-7' };
      const { sales, cashSessions } = paymentSales(state);

      const result = await sales.registerPayment({ businessId: 'biz-A', orderId: state.order.id, amount: 400, method: 'card' });

      expect(result.ok).toBe(true);
      expect(cashSessions.findOpenBySucursalForPayment).toHaveBeenCalledWith('biz-A', 'suc-1');
      expect(state.payments).toEqual([expect.objectContaining({ amount: 400, method: 'card', cashSessionId: 'cash-7' })]);
      expect(result.value!.payments[0].cashSessionId).toBe('cash-7');
    });

    it('rejects a payment without an open cash session and writes nothing', async () => {
      const original = openOrder();
      const state: PaymentState = { order: original, payments: [], cashSessionId: null };
      const { sales } = paymentSales(state);

      const result = await sales.registerPayment({ businessId: 'biz-A', orderId: original.id, amount: 1000, method: 'cash' });

      expect(result.ok).toBe(false);
      expect(result.error!.message).toBe('Abrí la caja para cobrar');
      expect(state.payments).toEqual([]);
      expect(state.order).toBe(original);
    });
  });
});
