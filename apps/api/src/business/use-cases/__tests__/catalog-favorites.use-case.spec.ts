import { Money, Product, TopSeller } from '@unna/domain';
import { ProductUseCase } from '../product.use-case';
import { fake } from './test-doubles';

const BUSINESS = 'biz-A';
const NOW = new Date('2026-10-25T15:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const existing = () =>
  Product.create({
    businessId: BUSINESS, categoryId: 'cat-A', name: 'Café', type: 'simple', status: 'active',
    basePrice: Money.fromCents(150000), taxRate: 21, displayOrder: 0, isActive: true, images: [], modifierGroupIds: [],
  });

const setup = (topSellers: TopSeller[] = []) => {
  const saved: Product[] = [];
  const stored = existing();
  const findTopSellers = jest.fn(async () => topSellers);
  const products = {
    findByIdAndBusinessId: async (id: string, businessId: string) => (id === stored.id && businessId === BUSINESS ? saved.at(-1) ?? stored : null),
    save: async (p: Product) => {
      saved.push(p);
    },
    findTopSellers,
  };
  const categories = { findByIdAndBusinessId: async (id: string, businessId: string) => (id === 'cat-A' && businessId === BUSINESS ? { id } : null) };
  const useCase = new ProductUseCase(fake(products), fake(categories), fake({}));
  return { useCase, saved, stored, findTopSellers };
};

const owner = { businessId: BUSINESS, ownerId: 'owner-1' };

describe('Product favorites (S13)', () => {
  it('creates a pinned favorite when asked and an unpinned product by default', async () => {
    const { useCase, saved } = setup();
    const base = { ...owner, categoryId: 'cat-A', name: 'Café', type: 'simple' as const, basePrice: 1000 };

    const pinned = await useCase.create({ ...base, isFavorite: true });
    const plain = await useCase.create(base);

    expect(pinned.value?.isFavorite).toBe(true);
    expect(plain.value?.isFavorite).toBe(false);
    expect(saved.map((p) => p.isFavorite)).toEqual([true, false]);
  });

  it('pins and unpins through update and keeps the flag when other fields change', async () => {
    const { useCase, stored } = setup();

    expect((await useCase.update({ ...owner, id: stored.id, isFavorite: true })).value?.isFavorite).toBe(true);
    expect((await useCase.update({ ...owner, id: stored.id, name: 'Cortado' })).value?.isFavorite).toBe(true);
    expect((await useCase.update({ ...owner, id: stored.id, isFavorite: false })).value?.isFavorite).toBe(false);
  });

  it('returns the flag in the product JSON', async () => {
    const { useCase } = setup();
    const created = await useCase.create({ ...owner, categoryId: 'cat-A', name: 'Café', type: 'simple', basePrice: 1000, isFavorite: true });
    expect(JSON.parse(JSON.stringify(created.value))).toMatchObject({ isFavorite: true });
  });
});

describe('Top sellers (S13)', () => {
  it('asks for the last 7 days and 8 products by default, scoped to the business', async () => {
    const rows = [{ productId: 'p1', name: 'Café', quantity: 12 }];
    const { useCase, findTopSellers } = setup(rows);

    const result = await useCase.topSellers(BUSINESS, {}, NOW);

    expect(result).toEqual({ ok: true, value: rows });
    expect(findTopSellers).toHaveBeenCalledWith(BUSINESS, new Date(NOW.getTime() - 7 * DAY_MS), 8);
  });

  it('uses the requested period and limit', async () => {
    const { useCase, findTopSellers } = setup();
    await useCase.topSellers(BUSINESS, { days: 30, limit: 20 }, NOW);
    expect(findTopSellers).toHaveBeenCalledWith(BUSINESS, new Date(NOW.getTime() - 30 * DAY_MS), 20);
  });

  it.each([
    [{ days: 0 }, 'El período debe ser de 1 a 30 días'],
    [{ days: 31 }, 'El período debe ser de 1 a 30 días'],
    [{ limit: 0 }, 'La cantidad debe ser de 1 a 20 productos'],
    [{ limit: 21 }, 'La cantidad debe ser de 1 a 20 productos'],
  ])('rejects %p without querying', async (query, message) => {
    const { useCase, findTopSellers } = setup();
    const result = await useCase.topSellers(BUSINESS, query, NOW);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe(message);
    expect(findTopSellers).not.toHaveBeenCalled();
  });
});
