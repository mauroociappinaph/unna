import { CategoryUseCase } from '../category.use-case';
import { ProductInput, ProductUseCase } from '../product.use-case';
import { StockUseCase } from '../stock.use-case';
import { StockLevel } from '@unna/domain';
import { fake } from './test-doubles';

// Business A's owner sends their own businessId together with ids that belong to business B.
const OWN = 'biz-A';
const FOREIGN = 'biz-B';

const byBusiness = <T extends { id: string; businessId: string }>(rows: T[]) => ({
  findByIdAndBusinessId: async (id: string, businessId: string) =>
    rows.find((r) => r.id === id && r.businessId === businessId) ?? null,
});

const productsRepo = () => ({
  ...byBusiness([
    { id: 'prod-A', businessId: OWN },
    { id: 'prod-B', businessId: FOREIGN },
  ]),
  findByCategoryId: async (categoryId: string) =>
    categoryId === 'cat-B' ? [{ id: 'prod-B', businessId: FOREIGN }] : [{ id: 'prod-A', businessId: OWN }],
  save: jest.fn(),
});

const categoriesRepo = () => ({
  ...byBusiness([
    { id: 'cat-A', businessId: OWN },
    { id: 'cat-B', businessId: FOREIGN },
  ]),
  save: jest.fn(),
});

const groupsRepo = () =>
  byBusiness([
    { id: 'grp-A', businessId: OWN },
    { id: 'grp-B', businessId: FOREIGN },
  ]);

const foreignLevel = () =>
  StockLevel.create({
    productId: 'prod-B', businessId: FOREIGN, currentQuantity: 50, reservedQuantity: 0,
    minThreshold: 10, reorderPoint: 5, reorderQuantity: 20,
  });

describe('Catalog tenant isolation', () => {
  describe('StockUseCase with a foreign product id', () => {
    let saved: unknown[];
    let stock: StockUseCase;

    beforeEach(() => {
      saved = [];
      stock = new StockUseCase(
        fake({ findByProductId: async () => foreignLevel(), save: async (l: unknown) => saved.push(l) }),
        fake({ findByProductId: async () => [{ businessId: FOREIGN }], save: jest.fn() }),
        fake(productsRepo()),
        fake({ withStockLock: jest.fn(), initialize: jest.fn() }),
      );
    });

    it.each([
      ['getLevel', (s: StockUseCase) => s.getLevel('prod-B', OWN)],
      ['recordCount', (s: StockUseCase) => s.recordCount({ productId: 'prod-B', businessId: OWN, ownerId: 'u', countedQuantity: 0 })],
      ['adjustThresholds', (s: StockUseCase) => s.adjustThresholds({ productId: 'prod-B', businessId: OWN, ownerId: 'u', minThreshold: 1 })],
      ['listMovements', (s: StockUseCase) => s.listMovements(OWN, { productId: 'prod-B' }, { limit: 50 })],
    ])('%s is rejected and writes nothing', async (_name, run) => {
      const result = await run(stock);
      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('Producto no encontrado');
      expect(saved).toHaveLength(0);
    });
  });

  describe('ProductUseCase', () => {
    const useCase = () => new ProductUseCase(fake(productsRepo()), fake(categoriesRepo()), fake(groupsRepo()));
    const base: { businessId: string; ownerId: string } & ProductInput = {
      businessId: OWN, ownerId: 'u', categoryId: 'cat-A', name: 'Milanesa', type: 'simple', basePrice: 1000,
    };

    it('rejects listing by a foreign category', async () => {
      const result = await useCase().list(OWN, { categoryId: 'cat-B' });
      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('Categoría no encontrada');
    });

    it('rejects a foreign modifier group', async () => {
      const result = await useCase().create({ ...base, modifierGroupIds: ['grp-B'] });
      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('Grupo de modificadores grp-B no encontrado');
    });

    it('rejects a foreign component product', async () => {
      const result = await useCase().create({ ...base, type: 'combo', components: [{ productId: 'prod-B', quantity: 1 }] });
      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('Producto componente prod-B no encontrado');
    });

    it('accepts own modifier groups and components', async () => {
      const result = await useCase().create({
        ...base, type: 'combo', modifierGroupIds: ['grp-A'], components: [{ productId: 'prod-A', quantity: 1 }],
      });
      expect(result.ok).toBe(true);
    });
  });

  describe('CategoryUseCase', () => {
    it('rejects a foreign parent category', async () => {
      const repo = categoriesRepo();
      const result = await new CategoryUseCase(fake(repo)).create({
        businessId: OWN, ownerId: 'u', name: 'Sub', type: 'plato', parentId: 'cat-B',
      });
      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('Categoría padre no encontrada');
      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
