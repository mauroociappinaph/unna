import { Injectable } from '@nestjs/common';
import { Prisma, StockMovement as StockMovementRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Page, PageRequest, StockMovementListFilters, StockMovementRepositoryPort, StockMovement } from '@unna/domain';
import { cursorFields, keysetPage, mapPage, NEWEST_FIRST, withinDates } from './keyset-page';
import type { Db } from './sales.repository.adapter';

/** Stock movements on the root client or on an open transaction (the stock unit of work). */
export class PrismaStockMovementRepository implements StockMovementRepositoryPort {
  constructor(private readonly prisma: Db) {}

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

  async findPageByBusinessId(businessId: string, filters: StockMovementListFilters, page: PageRequest): Promise<Page<StockMovement> | null> {
    const conditions: Prisma.StockMovementWhereInput[] = [{ businessId }];
    if (filters.productId) conditions.push({ productId: filters.productId });
    const createdAt = withinDates(filters.from, filters.to);
    if (createdAt) conditions.push({ createdAt });

    const rows = await keysetPage(
      page,
      (id) => this.prisma.stockMovement.findFirst({ where: { id, businessId }, select: cursorFields }),
      (after, take) =>
        this.prisma.stockMovement.findMany({ where: { AND: after ? [...conditions, after] : conditions }, orderBy: NEWEST_FIRST, take }),
    );
    return mapPage(rows, (r) => this.toDomain(r));
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

@Injectable()
export class PrismaStockMovementRepositoryAdapter extends PrismaStockMovementRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }
}
