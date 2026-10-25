import { Injectable } from '@nestjs/common';
import { StockLevel as StockLevelRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockLevelRepositoryPort, StockLevel } from '@unna/domain';

@Injectable()
export class PrismaStockLevelRepositoryAdapter implements StockLevelRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(level: StockLevel): Promise<void> {
    const data = {
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

  async delete(productId: string): Promise<void> {
    await this.prisma.stockLevel.delete({ where: { productId } });
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
