import { InMemoryStock, stockLevel } from './stock-fakes';

// S21: every stock change reads the level under the row lock and saves level and movement together.
const exit = (quantity: number) => ({ productId: 'prod-A', businessId: 'biz-A', ownerId: 'owner-1', quantity, reason: 'Venta mostrador' });

describe('StockUseCase under the stock row lock', () => {
  it('two parallel exits of 3 from 10 leave 4 and record both movements', async () => {
    const stock = new InMemoryStock(stockLevel(10));
    const useCase = stock.useCase();

    const results = await Promise.all([useCase.removeStock(exit(3)), useCase.removeStock(exit(3))]);

    expect(results.map((r) => r.value?.level.currentQuantity).sort()).toEqual([4, 7]);
    expect(stock.level?.currentQuantity).toBe(4);
    expect(stock.movements.map((m) => [m.type, m.quantity])).toEqual([['out', 3], ['out', 3]]);
  });

  it('checks the stock on the locked value: only one of two parallel exits of 6 from 10 passes', async () => {
    const stock = new InMemoryStock(stockLevel(10));
    const useCase = stock.useCase();

    const results = await Promise.allSettled([useCase.removeStock(exit(6)), useCase.removeStock(exit(6))]);

    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected?.reason.message).toBe('Stock insuficiente. Disponible: 4, solicitado: 6');
    expect(stock.level?.currentQuantity).toBe(4);
    expect(stock.movements).toHaveLength(1);
  });

  it('parallel entries add up', async () => {
    const stock = new InMemoryStock(stockLevel(10));
    const useCase = stock.useCase();

    await Promise.all([useCase.addStock({ ...exit(5), reason: 'Compra' }), useCase.addStock({ ...exit(2), reason: 'Compra' })]);

    expect(stock.level?.currentQuantity).toBe(17);
    expect(stock.movements).toHaveLength(2);
  });

  it.each([
    ['addStock', (s: InMemoryStock) => s.useCase().addStock({ ...exit(5), reason: 'Compra' })],
    ['removeStock', (s: InMemoryStock) => s.useCase().removeStock(exit(3))],
    ['recordCount', (s: InMemoryStock) => s.useCase().recordCount({ productId: 'prod-A', businessId: 'biz-A', ownerId: 'owner-1', countedQuantity: 8 })],
  ])('%s saves the level and its movement in one transaction', async (_name, run) => {
    const stock = new InMemoryStock(stockLevel(10));

    const result = await run(stock);

    expect(result.ok).toBe(true);
    expect(stock.transactions).toEqual([['level', 'movement']]);
  });

  it('a rejected exit writes nothing', async () => {
    const stock = new InMemoryStock(stockLevel(2));

    await expect(stock.useCase().removeStock(exit(3))).rejects.toThrow('Stock insuficiente. Disponible: 2, solicitado: 3');

    expect(stock.level?.currentQuantity).toBe(2);
    expect(stock.movements).toHaveLength(0);
  });

  it.each([
    ['addStock', 'Nivel de stock no inicializado para este producto', (s: InMemoryStock) => s.useCase().addStock(exit(1))],
    ['removeStock', 'Nivel de stock no encontrado', (s: InMemoryStock) => s.useCase().removeStock(exit(1))],
    ['recordCount', 'Nivel de stock no encontrado', (s: InMemoryStock) => s.useCase().recordCount({ productId: 'prod-A', businessId: 'biz-A', ownerId: 'owner-1', countedQuantity: 1 })],
  ])('%s without an initialized stock answers "%s" and writes nothing', async (_name, message, run) => {
    const stock = new InMemoryStock(null);

    const result = await run(stock);

    expect([result.ok, result.error?.message]).toEqual([false, message]);
    expect([stock.level, stock.movements, stock.transactions]).toEqual([null, [], []]);
  });
});

describe('StockUseCase.recordCount', () => {
  const count = (countedQuantity: number) => ({ productId: 'prod-A', businessId: 'biz-A', ownerId: 'owner-1', countedQuantity });

  it('stores the adjustment movement of the count, by the owner', async () => {
    const stock = new InMemoryStock(stockLevel(10));

    const result = await stock.useCase().recordCount(count(7));

    expect(result.value?.currentQuantity).toBe(7);
    expect(stock.level?.currentQuantity).toBe(7);
    expect(stock.movements).toHaveLength(1);
    expect(stock.movements[0]).toMatchObject({ type: 'adjustment', quantity: -3, reason: 'Conteo físico de inventario', performedBy: 'owner-1' });
  });

  it('a count that matches the stock records the count without a movement', async () => {
    const stock = new InMemoryStock(stockLevel(10));

    const result = await stock.useCase().recordCount(count(10));

    expect(result.ok).toBe(true);
    expect(stock.level?.lastCountedAt).toBeInstanceOf(Date);
    expect(stock.movements).toHaveLength(0);
    expect(stock.transactions).toEqual([['level']]);
  });
});

describe('StockUseCase.initializeStock', () => {
  const init = { productId: 'prod-A', businessId: 'biz-A', ownerId: 'owner-1', initialQuantity: 12 };

  it('stores the level and the opening movement together', async () => {
    const stock = new InMemoryStock(null);

    const result = await stock.useCase().initializeStock(init);

    expect(result.value?.currentQuantity).toBe(12);
    expect(stock.transactions).toEqual([['level', 'movement']]);
    expect(stock.movements[0]).toMatchObject({ type: 'in', quantity: 12, reason: 'Stock inicial', performedBy: 'owner-1' });
  });

  it('starting at zero stores the level without a movement', async () => {
    const stock = new InMemoryStock(null);

    const result = await stock.useCase().initializeStock({ ...init, initialQuantity: 0 });

    expect(result.value?.currentQuantity).toBe(0);
    expect([stock.level?.currentQuantity, stock.movements, stock.transactions]).toEqual([0, [], [['level']]]);
  });

  it('two parallel initializations store one level and one movement', async () => {
    const stock = new InMemoryStock(null);
    const useCase = stock.useCase();

    const results = await Promise.all([useCase.initializeStock(init), useCase.initializeStock({ ...init, initialQuantity: 30 })]);

    expect(results.map((r) => r.ok).sort()).toEqual([false, true]);
    expect(results.find((r) => !r.ok)?.error?.message).toBe('El stock ya está inicializado para este producto');
    expect(stock.movements).toHaveLength(1);
    expect(stock.level?.currentQuantity).toBe(stock.movements[0].quantity);
  });

  it('an already initialized product is rejected without writes', async () => {
    const stock = new InMemoryStock(stockLevel(5));

    const result = await stock.useCase().initializeStock(init);

    expect(result.error?.message).toBe('El stock ya está inicializado para este producto');
    expect([stock.level?.currentQuantity, stock.movements, stock.transactions]).toEqual([5, [], []]);
  });
});
