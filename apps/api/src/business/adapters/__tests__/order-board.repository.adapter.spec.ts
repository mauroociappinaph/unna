import { Money, Product } from '@unna/domain';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaOrderBoardRepositoryAdapter } from '../order-board.repository.adapter';
import { PrismaProductRepositoryAdapter } from '../product.repository.adapter';
import { fake } from '../../use-cases/__tests__/test-doubles';

const FROM = new Date('2026-10-25T03:00:00Z');
const TO = new Date('2026-10-26T03:00:00Z');

describe('PrismaOrderBoardRepositoryAdapter (S13)', () => {
  it('reads fully paid orders of the sucursal in the window and maps items to names only', async () => {
    const createdAt = new Date('2026-10-25T12:00:00Z');
    const findMany = jest.fn(async () => [
      {
        id: 'o1', orderNumber: 'ORD-1', status: 'preparing', type: 'takeaway', customerName: null, tableNumber: null,
        createdAt, updatedAt: createdAt, totalAmount: 5000, customerPhone: '11',
        items: [
          { productName: 'Latte', quantity: 2, notes: null, modifiers: [{ modifierGroupId: 'g', optionId: 'o', name: 'Avena', priceDelta: 300 }] },
          { productName: 'Medialuna', quantity: 1, notes: 'Calentar', modifiers: null },
        ],
      },
    ]);
    const adapter = new PrismaOrderBoardRepositoryAdapter(fake<PrismaService>({ order: { findMany } }));

    const orders = await adapter.findPaidOrders('biz-A', 'suc-1', { from: FROM, to: TO }, ['pending', 'ready']);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-A',
        sucursalId: 'suc-1',
        paymentStatus: 'completed',
        status: { in: ['pending', 'ready'] },
        createdAt: { gte: FROM, lt: TO },
      },
      select: {
        id: true, orderNumber: true, status: true, type: true, customerName: true, tableNumber: true, createdAt: true, updatedAt: true,
        items: { select: { productName: true, quantity: true, notes: true, modifiers: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(orders).toEqual([
      {
        id: 'o1', orderNumber: 'ORD-1', status: 'preparing', type: 'takeaway', customerName: undefined, tableNumber: undefined,
        createdAt, updatedAt: createdAt,
        items: [
          { productName: 'Latte', quantity: 2, modifiers: ['Avena'], notes: undefined },
          { productName: 'Medialuna', quantity: 1, modifiers: [], notes: 'Calentar' },
        ],
      },
    ]);
  });

  it('looks the token up by its hash through the unique index and never selects the hash', async () => {
    const findUnique = jest.fn(async () => ({ id: 'suc-1', businessId: 'biz-A', name: 'Palermo' }));
    const adapter = new PrismaOrderBoardRepositoryAdapter(fake<PrismaService>({ sucursal: { findUnique } }));

    expect(await adapter.findSucursalByDisplayTokenHash('abc123')).toEqual({ id: 'suc-1', businessId: 'biz-A', name: 'Palermo' });
    expect(findUnique).toHaveBeenCalledWith({ where: { displayTokenHash: 'abc123' }, select: { id: true, businessId: true, name: true } });
  });

  it('finds a sucursal only within its business', async () => {
    const findFirst = jest.fn(async () => null);
    const adapter = new PrismaOrderBoardRepositoryAdapter(fake<PrismaService>({ sucursal: { findFirst } }));

    expect(await adapter.findSucursal('biz-B', 'suc-1')).toBeNull();
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'suc-1', businessId: 'biz-B' }, select: { id: true, businessId: true, name: true } });
  });

  it('replaces or clears the hash only on the business\'s sucursal', async () => {
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const adapter = new PrismaOrderBoardRepositoryAdapter(fake<PrismaService>({ sucursal: { updateMany } }));
    const at = new Date('2026-10-25T15:00:00Z');

    await adapter.setDisplayTokenHash('biz-A', 'suc-1', 'hash', at);
    await adapter.setDisplayTokenHash('biz-A', 'suc-1', null, null);

    expect(updateMany.mock.calls).toEqual([
      [{ where: { id: 'suc-1', businessId: 'biz-A' }, data: { displayTokenHash: 'hash', displayTokenCreatedAt: at } }],
      [{ where: { id: 'suc-1', businessId: 'biz-A' }, data: { displayTokenHash: null, displayTokenCreatedAt: null } }],
    ]);
  });
});

describe('PrismaProductRepositoryAdapter top sellers and favorites (S13)', () => {
  const since = new Date('2026-10-18T15:00:00Z');

  it('sums units of the business\'s paid, not cancelled or refunded orders for active products, most sold first', async () => {
    const groupBy = jest.fn(async () => [
      { productId: 'p2', _sum: { quantity: 9 } },
      { productId: 'p1', _sum: { quantity: 4 } },
    ]);
    const findMany = jest.fn(async () => [
      { id: 'p1', name: 'Medialuna' },
      { id: 'p2', name: 'Café' },
    ]);
    const adapter = new PrismaProductRepositoryAdapter(fake<PrismaService>({ orderItem: { groupBy }, product: { findMany } }));

    const top = await adapter.findTopSellers('biz-A', since, 8);

    expect(groupBy).toHaveBeenCalledWith({
      by: ['productId'],
      where: {
        order: { businessId: 'biz-A', paymentStatus: 'completed', status: { notIn: ['cancelled', 'refunded'] }, createdAt: { gte: since } },
        product: { businessId: 'biz-A', isActive: true, status: 'active' },
      },
      _sum: { quantity: true },
      orderBy: [{ _sum: { quantity: 'desc' } }, { productId: 'asc' }],
      take: 8,
    });
    expect(findMany).toHaveBeenCalledWith({ where: { id: { in: ['p2', 'p1'] }, businessId: 'biz-A' }, select: { id: true, name: true } });
    expect(top).toEqual([
      { productId: 'p2', name: 'Café', quantity: 9 },
      { productId: 'p1', name: 'Medialuna', quantity: 4 },
    ]);
  });

  it('skips the product lookup when nothing was sold', async () => {
    const findMany = jest.fn();
    const adapter = new PrismaProductRepositoryAdapter(fake<PrismaService>({ orderItem: { groupBy: async () => [] }, product: { findMany } }));
    expect(await adapter.findTopSellers('biz-A', since, 8)).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('stores and reads back the favorite flag', async () => {
    const rows: Record<string, unknown>[] = [];
    const prisma = {
      product: {
        upsert: async ({ create }: { create: Record<string, unknown> }) => {
          rows.push({ ...create, updatedAt: create.createdAt });
        },
        findFirst: async () => rows[0],
      },
    };
    const adapter = new PrismaProductRepositoryAdapter(fake<PrismaService>(prisma));
    const product = Product.create({
      businessId: 'biz-A', categoryId: 'cat-A', name: 'Café', type: 'simple', status: 'active', basePrice: Money.fromCents(1000),
      taxRate: 21, displayOrder: 0, isActive: true, images: [], modifierGroupIds: [], isFavorite: true,
    });

    await adapter.save(product);

    expect(rows[0]).toMatchObject({ isFavorite: true });
    expect((await adapter.findByIdAndBusinessId(product.id, 'biz-A'))?.isFavorite).toBe(true);
  });
});
