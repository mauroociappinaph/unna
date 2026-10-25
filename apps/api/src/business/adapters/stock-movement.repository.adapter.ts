import { Injectable } from '@nestjs/common';
import { StockMovement as StockMovementRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockMovementRepositoryPort, StockMovement } from '@unna/domain';

@Injectable()
export class PrismaStockMovementRepositoryAdapter implements StockMovementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(m: StockMovement): Promise<void> {
    await this.prisma.stockMovement.create({
      data: {
        id: m.id,
        productId: m.productId,
        businessId: m.businessId,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        referenceId: m.referenceId ?? null,
        referenceType: m.referenceType ?? null,
        unitCost: m.unitCost ?? null,
        totalCost: m.totalCost ?? null,
        performedBy: m.performedBy,
        createdAt: m.createdAt,
      },
    });
  }

  async findByProductId(productId: string): Promise<StockMovement[]> {
    const records = await this.prisma.stockMovement.findMany({ where: { productId }, orderBy: { createdAt: 'desc' } });
    return records.map((r) => this.toDomain(r));
  }

  async findByBusinessId(businessId: string): Promise<StockMovement[]> {
    const records = await this.prisma.stockMovement.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
    return records.map((r) => this.toDomain(r));
  }

  async findByBusinessIdAndDateRange(businessId: string, from: Date, to: Date): Promise<StockMovement[]> {
    const records = await this.prisma.stockMovement.findMany({
      where: { businessId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(r: StockMovementRecord): StockMovement {
    return StockMovement.reconstitute({
      id: r.id,
      productId: r.productId,
      businessId: r.businessId,
      type: r.type as StockMovement['type'],
      quantity: r.quantity,
      reason: r.reason,
      referenceId: r.referenceId ?? undefined,
      referenceType: r.referenceType ?? undefined,
      unitCost: r.unitCost ?? undefined,
      totalCost: r.totalCost ?? undefined,
      performedBy: r.performedBy,
      createdAt: r.createdAt,
    });
  }
}
