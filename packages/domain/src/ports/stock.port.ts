// Stock changes under the product's stock row lock (S21). Reads and lists stay on
// StockLevelRepositoryPort and StockMovementRepositoryPort in repository.port.ts.
import type { StockLevel, StockMovement } from '../value-objects/stock';

/** Writes that commit together with the transaction holding the stock row lock. */
export interface LockedStockWrites {
  saveLevel(level: StockLevel): Promise<void>;
  saveMovement(movement: StockMovement): Promise<void>;
}

export interface StockUnitOfWorkPort {
  /**
   * Runs `work` in one transaction holding a lock on the product's stock row, so concurrent changes
   * of the same product run one after another. `level` is read under the lock (null when the
   * product's stock was never initialized); the writes commit together or not at all.
   */
  withStockLock<T>(productId: string, work: (level: StockLevel | null, writes: LockedStockWrites) => Promise<T>): Promise<T>;
  /**
   * Stores the first level and its opening movement (none when it starts at zero) in one transaction. False, writing nothing, when
   * the product already has stock, also when a concurrent call created it first.
   */
  initialize(level: StockLevel, movement: StockMovement | null): Promise<boolean>;
}
