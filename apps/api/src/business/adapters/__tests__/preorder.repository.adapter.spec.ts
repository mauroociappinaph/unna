import type { OnlineCheckoutRecord } from '@unna/domain';
import { PrismaService } from '../../../prisma/prisma.service';
import { fake } from '../../use-cases/__tests__/test-doubles';
import { PrismaPreorderRepositoryAdapter } from '../preorder.repository.adapter';
import { PrismaOnlineCheckoutRepositoryAdapter } from '../online-checkout.repository.adapter';
import { PrismaOnlineCheckoutUnitOfWorkAdapter } from '../online-checkout-unit-of-work.adapter';

const SLUG = 'Pa_slug-0123456789ab';
const SCHEDULE = { monday: { open: '08:00', close: '20:00', isClosed: false } };
const ROW = { id: 'suc-1', businessId: 'biz-A', name: 'Palermo', isActive: true, preorderEnabled: true, preorderSlug: SLUG };

const CHECKOUT: OnlineCheckoutRecord = {
  id: 'co-1', businessId: 'biz-A', sucursalId: 'suc-1', sucursalName: 'Palermo', trackingTokenHash: 'hash', status: 'awaiting_payment',
  customerName: 'Ana', lines: [], total: 60500, mpOrderId: null, checkoutUrl: null, expiresAt: new Date('2026-10-26T15:15:00Z'), paidAt: null,
  orderId: null, paymentId: null, mpPaymentId: null, paymentError: null, createdAt: new Date('2026-10-26T15:00:00Z'), updatedAt: new Date('2026-10-26T15:00:00Z'),
};

describe('PrismaPreorderRepositoryAdapter (S20)', () => {
  it('lists and finds sucursales scoped to the business', async () => {
    const findMany = jest.fn(async () => [ROW]);
    const findFirst = jest.fn(async () => null);
    const adapter = new PrismaPreorderRepositoryAdapter(fake<PrismaService>({ sucursal: { findMany, findFirst } }));

    await expect(adapter.listSucursales('biz-A')).resolves.toEqual([{ id: 'suc-1', businessId: 'biz-A', name: 'Palermo', isActive: true, enabled: true, slug: SLUG }]);
    await expect(adapter.findSucursal('biz-A', 'suc-B')).resolves.toBeNull();

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { businessId: 'biz-A' }, orderBy: { createdAt: 'asc' } }));
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'suc-B', businessId: 'biz-A' } }));
  });

  it('finds only an enabled slug, with the business name and the sucursal schedule', async () => {
    const findFirst = jest.fn(async () => ({ ...ROW, schedule: SCHEDULE, business: { name: 'Café UNNA', isActive: true } }));
    const adapter = new PrismaPreorderRepositoryAdapter(fake<PrismaService>({ sucursal: { findFirst } }));

    const local = await adapter.findEnabledBySlug(SLUG);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { preorderSlug: SLUG, preorderEnabled: true } }));
    expect(local).toMatchObject({ id: 'suc-1', businessName: 'Café UNNA', businessActive: true, enabled: true, slug: SLUG });
    expect(local!.schedule.isOpenAt('monday', '08:00')).toBe(true);
  });

  it('enables keeping the first slug: the candidate is written only where there is none', async () => {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const findFirst = jest.fn(async () => ({ preorderSlug: 'First_slug-0123456789' }));
    const $transaction = jest.fn(async (writes: Promise<unknown>[]) => Promise.all(writes));
    const adapter = new PrismaPreorderRepositoryAdapter(fake<PrismaService>({ sucursal: { updateMany, findFirst }, $transaction }));

    await expect(adapter.enable('biz-A', 'suc-1', SLUG)).resolves.toBe('First_slug-0123456789');

    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'suc-1', businessId: 'biz-A', preorderSlug: null }, data: { preorderSlug: SLUG } });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'suc-1', businessId: 'biz-A' }, data: { preorderEnabled: true } });
  });

  it('disables keeping the slug', async () => {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const adapter = new PrismaPreorderRepositoryAdapter(fake<PrismaService>({ sucursal: { updateMany } }));

    await adapter.disable('biz-A', 'suc-1');

    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'suc-1', businessId: 'biz-A' }, data: { preorderEnabled: false } });
  });
});

describe('PrismaOnlineCheckoutRepositoryAdapter (S20)', () => {
  it('creates the record and reads it back by id and by Mercado Pago order', async () => {
    const create = jest.fn(async () => CHECKOUT);
    const findUnique = jest.fn(async () => CHECKOUT);
    const adapter = new PrismaOnlineCheckoutRepositoryAdapter(fake<PrismaService>({ onlineCheckout: { create, findUnique } }));

    await adapter.create(CHECKOUT);
    await expect(adapter.findById('co-1')).resolves.toEqual(CHECKOUT);
    await expect(adapter.findByMpOrderId('ORD1')).resolves.toEqual(CHECKOUT);

    expect(create).toHaveBeenCalledWith({ data: { ...CHECKOUT, lines: [] } });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'co-1' } });
    expect(findUnique).toHaveBeenCalledWith({ where: { mpOrderId: 'ORD1' } });
  });

  it('reads the tracking by token hash with the business name and the order status only', async () => {
    const order = { orderNumber: '261026-00042', status: 'preparing', updatedAt: new Date('2026-10-26T15:05:00Z') };
    const findUnique = jest.fn(async () => ({ ...CHECKOUT, business: { name: 'Café UNNA' }, order }));
    const adapter = new PrismaOnlineCheckoutRepositoryAdapter(fake<PrismaService>({ onlineCheckout: { findUnique } }));

    await expect(adapter.findTrackingByTokenHash('hash')).resolves.toEqual({ checkout: CHECKOUT, businessName: 'Café UNNA', order });
    expect(findUnique).toHaveBeenCalledWith({
      where: { trackingTokenHash: 'hash' },
      include: { business: { select: { name: true } }, order: { select: { orderNumber: true, status: true, updatedAt: true } } },
    });
  });

  it('attaches the Mercado Pago order only to a checkout without one, and updates the outcome fields', async () => {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const adapter = new PrismaOnlineCheckoutRepositoryAdapter(fake<PrismaService>({ onlineCheckout: { updateMany } }));
    const paid = { ...CHECKOUT, status: 'paid' as const, paidAt: new Date('2026-10-26T15:01:00Z'), orderId: 'o-1', paymentId: 'p-1', mpPaymentId: 'PAY1' };

    await adapter.attachMercadoPagoOrder('co-1', 'ORD1', 'https://mp/checkout');
    await adapter.update(paid);

    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'co-1', mpOrderId: null }, data: { mpOrderId: 'ORD1', checkoutUrl: 'https://mp/checkout' } });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'co-1' },
      data: { status: 'paid', paidAt: paid.paidAt, orderId: 'o-1', paymentId: 'p-1', mpPaymentId: 'PAY1', paymentError: null },
    });
  });
});

describe('PrismaOnlineCheckoutUnitOfWorkAdapter (S20)', () => {
  it('locks the checkout row in one transaction and binds the repositories to it', async () => {
    const queryRaw = jest.fn(async () => []);
    const findUnique = jest.fn(async () => CHECKOUT);
    const tx = { $queryRaw: queryRaw, onlineCheckout: { findUnique } };
    const $transaction = jest.fn(async (work: (t: typeof tx) => Promise<unknown>) => work(tx));
    const adapter = new PrismaOnlineCheckoutUnitOfWorkAdapter(fake<PrismaService>({ $transaction }));

    const found = await adapter.withCheckoutLock('co-1', (repositories) => repositories.checkouts.findById('co-1'));

    expect(found).toEqual(CHECKOUT);
    expect($transaction).toHaveBeenCalledTimes(1);
    const [strings, id] = queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, string];
    expect(strings.join('?')).toContain('FROM online_checkouts WHERE id = ? FOR UPDATE');
    expect(id).toBe('co-1');
  });
});
