import { Money } from '../money';
import { Product } from '../product';

const props = () => ({
  businessId: 'biz-1',
  categoryId: 'cat-1',
  name: 'Café',
  type: 'simple' as const,
  status: 'active' as const,
  basePrice: Money.fromCents(150000),
  taxRate: 21,
  displayOrder: 0,
  isActive: true,
  images: [],
  modifierGroupIds: [],
});

describe('Product favorites (S13)', () => {
  it('is not a favorite unless created as one', () => {
    expect(Product.create(props()).isFavorite).toBe(false);
    expect(Product.create({ ...props(), isFavorite: true }).isFavorite).toBe(true);
  });

  it('defaults to not favorite when reconstituted without the flag', () => {
    const product = Product.create(props());
    const stored = { ...product, isFavorite: undefined };
    expect(Product.reconstitute(stored).isFavorite).toBe(false);
    expect(Product.reconstitute({ ...product, isFavorite: true }).isFavorite).toBe(true);
  });

  it('can be pinned and unpinned, and the flag survives other updates', () => {
    const pinned = Product.create(props()).setFavorite(true);
    expect(pinned.isFavorite).toBe(true);
    expect(pinned.updateName('Cortado').isFavorite).toBe(true);
    expect(pinned.setFavorite(false).isFavorite).toBe(false);
  });
});
