import { Injectable } from '@nestjs/common';
import { LockedStockWrites, StockLevel, StockMovement, StockUnitOfWorkPort } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaStockLevelRepository } from './stock-level.repository.adapter';
import { PrismaStockMovementRepository } from './stock-movement.repository.adapter';

/**
 * Each stock change is one short transaction (S21): lock the product's stock row, read it, apply
 * the domain rule and write the level and its movement. Nothing external is called inside (S18).
 */
@Injectable()
export class PrismaStockUnitOfWorkAdapter implements StockUnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {}

  withStockLock<T>(productId: string, work: (level: StockLevel | null, writes: LockedStockWrites) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Held until the transaction ends; a product without stock locks nothing and the work reports it.
      await tx.$queryRaw`SELECT id FROM stock_levels WHERE "productId" = ${productId} FOR UPDATE`;
      const levels = new PrismaStockLevelRepository(tx);
      const movements = new PrismaStockMovementRepository(tx);
      return work(await levels.findByProductId(productId), {
        saveLevel: (level) => levels.save(level),
        saveMovement: (movement) => movements.save(movement),
      });
    });
  }

  initialize(level: StockLevel, movement: StockMovement | null): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // The unique productId makes a concurrent insert wait for this one and then skip.
      if (!(await new PrismaStockLevelRepository(tx).createIfMissing(level))) return false;
      if (movement) await new PrismaStockMovementRepository(tx).save(movement);
      return true;
    });
  }
}
