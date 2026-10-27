import { StockMovement } from '@unna/domain';
import { InMemoryStock, stockLevel } from './stock-fakes';

describe('StockUseCase.removeStock', () => {
  let stock: InMemoryStock;
  let movements: StockMovement[];

  beforeEach(() => {
    stock = new InMemoryStock(stockLevel(50));
    movements = stock.movements;
  });

  it("records an 'out' movement when the type is omitted", async () => {
    const result = await stock.useCase().removeStock({ productId: 'prod-A', businessId: 'biz-A', ownerId: 'u', quantity: 3, reason: 'Rotura' });

    expect(result.ok).toBe(true);
    expect(result.value?.level.currentQuantity).toBe(47);
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('out');
  });

  it('keeps an explicit type', async () => {
    const result = await stock.useCase().removeStock({ productId: 'prod-A', businessId: 'biz-A', ownerId: 'u', quantity: 2, reason: 'Vencido', type: 'waste' });

    expect(result.ok).toBe(true);
    expect(movements[0].type).toBe('waste');
  });
});
