import { StockLevel, StockMovement } from '@unna/domain';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaStockUnitOfWorkAdapter } from '../stock-unit-of-work.adapter';
import { fake } from '../../use-cases/__tests__/test-doubles';

const row = {
  id: 'lvl-1', productId: 'prod-A', businessId: 'biz-A', currentQuantity: 10, reservedQuantity: 0, minThreshold: 10,
  maxThreshold: null, reorderPoint: 5, reorderQuantity: 20, lastCountedAt: null, lastMovementAt: null, updatedAt: new Date(),
};
const level = StockLevel.reconstitute({ ...row, maxThreshold: undefined, lastCountedAt: undefined, lastMovementAt: undefined });
const movement = StockMovement.create({ productId: 'prod-A', businessId: 'biz-A', type: 'out', quantity: 3, reason: 'Venta', performedBy: 'owner-1' });

/** Records, in order, the calls made inside the interactive transaction. */
const fakePrisma = (stored: typeof row | null, inserted = 1) => {
  const calls: string[] = [];
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(strings.reduce((text, part, i) => text + part + (i < values.length ? `<${String(values[i])}>` : ''), ''));
      return [];
    },
    stockLevel: {
      findUnique: async () => { calls.push('read level'); return stored; },
      upsert: async () => { calls.push('save level'); },
      createMany: async () => { calls.push('insert level'); return { count: inserted }; },
    },
    stockMovement: { create: async () => { calls.push('save movement'); } },
  };
  const prisma = { $transaction: async (work: (client: typeof tx) => Promise<unknown>) => work(tx) };
  return { unitOfWork: new PrismaStockUnitOfWorkAdapter(fake<PrismaService>(prisma)), calls };
};

describe('PrismaStockUnitOfWorkAdapter', () => {
  it('locks the stock row, reads it and writes level and movement in the same transaction', async () => {
    const { unitOfWork, calls } = fakePrisma(row);

    const seen = await unitOfWork.withStockLock('prod-A', async (locked, writes) => {
      await writes.saveLevel(level);
      await writes.saveMovement(movement);
      return locked?.currentQuantity;
    });

    expect(seen).toBe(10);
    expect(calls).toEqual([
      'SELECT id FROM stock_levels WHERE "productId" = <prod-A> FOR UPDATE',
      'read level',
      'save level',
      'save movement',
    ]);
  });

  it('hands the work a null level when the product has no stock', async () => {
    const { unitOfWork } = fakePrisma(null);

    expect(await unitOfWork.withStockLock('prod-A', async (locked) => locked)).toBeNull();
  });

  it('initializes the level and its movement together', async () => {
    const { unitOfWork, calls } = fakePrisma(null);

    expect(await unitOfWork.initialize(level, movement)).toBe(true);
    expect(calls).toEqual(['insert level', 'save movement']);
  });

  it('writes no movement when another call initialized the product first', async () => {
    const { unitOfWork, calls } = fakePrisma(null, 0);

    expect(await unitOfWork.initialize(level, movement)).toBe(false);
    expect(calls).toEqual(['insert level']);
  });
});
