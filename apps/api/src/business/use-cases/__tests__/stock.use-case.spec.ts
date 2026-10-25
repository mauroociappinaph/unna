import { StockUseCase } from '../stock.use-case';
import {
  ProductRepositoryPort,
  StockLevel,
  StockLevelRepositoryPort,
  StockMovement,
  StockMovementRepositoryPort,
} from '@unna/domain';
import { fake } from './test-doubles';

const level = () =>
  StockLevel.create({
    productId: 'prod-A', businessId: 'biz-A', currentQuantity: 50, reservedQuantity: 0,
    minThreshold: 10, reorderPoint: 5, reorderQuantity: 20,
  });

describe('StockUseCase.removeStock', () => {
  let movements: StockMovement[];
  let stock: StockUseCase;

  beforeEach(() => {
    movements = [];
    stock = new StockUseCase(
      fake<StockLevelRepositoryPort>({ findByProductId: async () => level(), save: async () => undefined }),
      fake<StockMovementRepositoryPort>({ save: async (m: StockMovement) => { movements.push(m); } }),
      fake<ProductRepositoryPort>({ findByIdAndBusinessId: async () => ({ id: 'prod-A' }) }),
    );
  });

  it("records an 'out' movement when the type is omitted", async () => {
    const result = await stock.removeStock({ productId: 'prod-A', businessId: 'biz-A', ownerId: 'u', quantity: 3, reason: 'Rotura' });

    expect(result.ok).toBe(true);
    expect(result.value?.level.currentQuantity).toBe(47);
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('out');
  });

  it('keeps an explicit type', async () => {
    const result = await stock.removeStock({ productId: 'prod-A', businessId: 'biz-A', ownerId: 'u', quantity: 2, reason: 'Vencido', type: 'waste' });

    expect(result.ok).toBe(true);
    expect(movements[0].type).toBe('waste');
  });
});
