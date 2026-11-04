import { StockLevel } from '../stock';

const level = (currentQuantity: number) =>
  StockLevel.create({
    productId: 'prod-A', businessId: 'biz-A', currentQuantity, reservedQuantity: 0,
    minThreshold: 10, reorderPoint: 5, reorderQuantity: 20,
  });

describe('StockLevel.recordCount', () => {
  it('returns the counted level and the adjustment movement by the person who counted', () => {
    const { level: counted, movement } = level(10).recordCount(7, 'owner-1');

    expect(counted.currentQuantity).toBe(7);
    expect(counted.lastCountedAt).toBeInstanceOf(Date);
    expect(movement).toMatchObject({
      productId: 'prod-A', businessId: 'biz-A', type: 'adjustment', quantity: -3,
      reason: 'Conteo físico de inventario', performedBy: 'owner-1',
    });
    expect(counted.lastMovementAt).toEqual(movement?.createdAt);
  });

  it('records a positive adjustment when more was counted', () => {
    const { level: counted, movement } = level(10).recordCount(12, 'owner-1');

    expect(counted.currentQuantity).toBe(12);
    expect(movement?.quantity).toBe(2);
  });

  it('records the count without a movement when it matches the stock', () => {
    const before = level(10);
    const { level: counted, movement } = before.recordCount(10, 'owner-1');

    expect(movement).toBeNull();
    expect(counted.currentQuantity).toBe(10);
    expect(counted.lastCountedAt).toBeInstanceOf(Date);
    expect(counted.lastMovementAt).toBe(before.lastMovementAt);
  });

  it('rejects a negative count', () => {
    expect(() => level(10).recordCount(-1, 'owner-1')).toThrow('Cantidad contada no puede ser negativa');
  });
});
