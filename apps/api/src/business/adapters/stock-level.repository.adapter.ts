import { Injectable } from '@nestjs/common';
import { StockLevel as StockLevelRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockLevelRepositoryPort, StockLevel } from '@unna/domain';
import type { Db } from './sales.repository.adapter';

/** Stock levels on the root client or on an open transaction (the stock unit of work). */
export class PrismaStockLevelRepository implements StockLevelRepositoryPort {
  constructor(private readonly prisma: Db) {}

  async save(level: StockLevel): Promise<void> {
    const data = this.toRecord(level);
    await this.prisma.stockLevel.upsert({
      where: { productId: level.productId },
      create: { productId: level.productId, ...data },
      update: data,
    });
  }

  async findByProductId(productId: string): Promise<StockLevel | null> {
    const record = await this.prisma.stockLevel.findUnique({ where: { productId } });
    return record ? this.toDomain(record) : null;
  }

  async findByBusinessId(businessId: string): Promise<StockLevel[]> {
    const records = await this.prisma.stockLevel.findMany({ where: { businessId } });
    return records.map((r) => this.toDomain(r));
  }

  async findLowStock(businessId: string): Promise<StockLevel[]> {
    const levels = await this.findByBusinessId(businessId);
    return levels.filter((l) => l.isLowStock());
  }

  /** Inserts the level unless the product already has one; a concurrent insert waits for the first and skips. */
  async createIfMissing(level: StockLevel): Promise<boolean> {
    const { count } = await this.prisma.stockLevel.createMany({
      data: [{ productId: level.productId, ...this.toRecord(level) }],
      skipDuplicates: true,
    });
    return count === 1;
  }

  async delete(productId: string): Promise<void> {
    await this.prisma.stockLevel.delete({ where: { productId } });
  }

  private toRecord(level: StockLevel) {
    return {
      businessId: level.businessId,
      currentQuantity: level.currentQuantity,
      reservedQuantity: level.reservedQuantity,
      minThreshold: level.minThreshold,
      maxThreshold: level.maxThreshold ?? null,
      reorderPoint: level.reorderPoint,
      reorderQuantity: level.reorderQuantity,
      lastCountedAt: level.lastCountedAt ?? null,
      lastMovementAt: level.lastMovementAt ?? null,
    };
  }

  private toDomain(r: StockLevelRecord): StockLevel {
    return StockLevel.reconstitute({
      productId: r.productId,
      businessId: r.businessId,
      currentQuantity: r.currentQuantity,
      reservedQuantity: r.reservedQuantity,
      minThreshold: r.minThreshold,
      maxThreshold: r.maxThreshold ?? undefined,
      reorderPoint: r.reorderPoint,
      reorderQuantity: r.reorderQuantity,
      lastCountedAt: r.lastCountedAt ?? undefined,
      lastMovementAt: r.lastMovementAt ?? undefined,
      updatedAt: r.updatedAt,
    });
  }
}

@Injectable()
export class PrismaStockLevelRepositoryAdapter extends PrismaStockLevelRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }
}
