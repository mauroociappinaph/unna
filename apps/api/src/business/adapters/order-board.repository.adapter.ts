import { Injectable } from '@nestjs/common';
import { BoardOrder, BoardSucursal, OrderBoardRepositoryPort, OrderItem, OrderStatus } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';

type LineModifiers = OrderItem['modifiers'];

// The display token hash is never selected: lookups go through its unique index only.
const SUCURSAL_FIELDS = { id: true, businessId: true, name: true } as const;

@Injectable()
export class PrismaOrderBoardRepositoryAdapter implements OrderBoardRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findSucursal(businessId: string, sucursalId: string): Promise<BoardSucursal | null> {
    return this.prisma.sucursal.findFirst({ where: { id: sucursalId, businessId }, select: SUCURSAL_FIELDS });
  }

  findSucursalByDisplayTokenHash(tokenHash: string): Promise<BoardSucursal | null> {
    return this.prisma.sucursal.findUnique({ where: { displayTokenHash: tokenHash }, select: SUCURSAL_FIELDS });
  }

  async setDisplayTokenHash(businessId: string, sucursalId: string, tokenHash: string | null, createdAt: Date | null): Promise<void> {
    await this.prisma.sucursal.updateMany({
      where: { id: sucursalId, businessId },
      data: { displayTokenHash: tokenHash, displayTokenCreatedAt: createdAt },
    });
  }

  async findPaidOrders(
    businessId: string,
    sucursalId: string,
    window: { from: Date; to: Date },
    statuses: readonly OrderStatus[],
  ): Promise<BoardOrder[]> {
    const records = await this.prisma.order.findMany({
      where: {
        businessId,
        sucursalId,
        paymentStatus: 'completed',
        status: { in: [...statuses] },
        createdAt: { gte: window.from, lt: window.to },
      },
      select: {
        id: true, orderNumber: true, status: true, type: true, customerName: true, tableNumber: true, createdAt: true, updatedAt: true,
        items: { select: { productName: true, quantity: true, notes: true, modifiers: true }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((r) => ({
      id: r.id,
      orderNumber: r.orderNumber,
      status: r.status as OrderStatus,
      type: r.type as BoardOrder['type'],
      customerName: r.customerName ?? undefined,
      tableNumber: r.tableNumber ?? undefined,
      items: r.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        modifiers: ((i.modifiers as LineModifiers | null) ?? []).map((m) => m.name),
        notes: i.notes ?? undefined,
      })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}
