import {
  LockedStockWrites,
  ProductRepositoryPort,
  StockLevel,
  StockLevelRepositoryPort,
  StockMovement,
  StockMovementRepositoryPort,
  StockUnitOfWorkPort,
} from '@unna/domain';
import { StockUseCase } from '../stock.use-case';
import { fake } from './test-doubles';

/** Lets the other pending calls run, like a database round trip. */
const roundTrip = () => new Promise<void>((resolve) => setImmediate(resolve));

export const stockLevel = (currentQuantity: number, productId = 'prod-A') =>
  StockLevel.create({
    productId, businessId: 'biz-A', currentQuantity, reservedQuantity: 0,
    minThreshold: 10, reorderPoint: 5, reorderQuantity: 20,
  });

type Write = { level: StockLevel } | { movement: StockMovement };

/**
 * One product's stock row. The unit of work runs the calls one after another, like the row lock,
 * and applies the writes of a call only when it finishes without throwing (commit or rollback).
 * `transactions` lists what each committed call that wrote something wrote.
 */
export class InMemoryStock {
  movements: StockMovement[] = [];
  transactions: Array<Array<'level' | 'movement'>> = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(public level: StockLevel | null) {}

  readonly unitOfWork: StockUnitOfWorkPort = {
    withStockLock: <T>(_productId: string, work: (level: StockLevel | null, writes: LockedStockWrites) => Promise<T>) => {
      const run = this.queue.then(async () => {
        await roundTrip();
        const pending: Write[] = [];
        const result = await work(this.level, {
          saveLevel: async (level) => { await roundTrip(); pending.push({ level }); },
          saveMovement: async (movement) => { await roundTrip(); pending.push({ movement }); },
        });
        this.commit(pending);
        return result;
      });
      this.queue = run.catch(() => undefined);
      return run;
    },
    initialize: async (level, movement) => {
      await roundTrip();
      if (this.level) return false;
      this.commit(movement ? [{ level }, { movement }] : [{ level }]);
      return true;
    },
  };

  /** Reads and writes without any lock or transaction. */
  readonly levels = fake<StockLevelRepositoryPort>({
    findByProductId: async () => { await roundTrip(); return this.level; },
    save: async (level: StockLevel) => { await roundTrip(); this.level = level; },
  });

  readonly movementRepository = fake<StockMovementRepositoryPort>({
    save: async (movement: StockMovement) => { this.movements.push(movement); },
  });

  useCase(product: unknown = { id: 'prod-A' }): StockUseCase {
    return new StockUseCase(
      this.levels,
      this.movementRepository,
      fake<ProductRepositoryPort>({ findByIdAndBusinessId: async () => product }),
      this.unitOfWork,
    );
  }

  private commit(writes: Write[]): void {
    for (const write of writes) {
      if ('level' in write) this.level = write.level;
      else this.movements.push(write.movement);
    }
    if (writes.length) this.transactions.push(writes.map((write) => ('level' in write ? 'level' : 'movement')));
  }
}
