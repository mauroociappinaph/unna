import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OrderRepositoryPort,
  OrderListFilters,
  PaymentRepositoryPort,
  PaymentRecord,
  SalesUnitOfWorkPort,
  LockedOrderRepositories,
  LockedCashSessionsPort,
  Address,
  Order,
  OrderItem,
  Money,
} from '@unna/domain';

const money = (cents: number) => Money.fromCents(cents, 'ARS');

/** Address columns hold the fields written from an Address value object; rebuild it on read. */
const toAddress = (json: Prisma.JsonValue | null): Address | undefined =>
  json ? Address.create(json as unknown as Parameters<typeof Address.create>[0]) : undefined;

/** The root client or the client of an open interactive transaction. */
export type Db = Prisma.TransactionClient;
/** Runs a batch of writes so they commit together. */
export type AtomicWrites = (writes: Prisma.PrismaPromise<unknown>[]) => Promise<unknown>;

/** Inside an open transaction the writes already commit together; run them in order. */
export const inOpenTransaction: AtomicWrites = async (writes) => {
  for (const write of writes) await write;
};

type OrderRecord = Prisma.OrderGetPayload<{ include: { items: true } }>;
type LineModifiers = OrderItem['modifiers'];

class PrismaOrderRepository implements OrderRepositoryPort {
  constructor(
    private readonly db: Db,
    private readonly atomically: AtomicWrites,
  ) {}

  async save(order: Order): Promise<void> {
    const data = {
      businessId: order.businessId,
      sucursalId: order.sucursalId,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      tableNumber: order.tableNumber ?? null,
      customerName: order.customerName ?? null,
      customerPhone: order.customerPhone ?? null,
      customerEmail: order.customerEmail ?? null,
      deliveryAddress: order.deliveryAddress ? { ...order.deliveryAddress } : undefined,
      subtotal: order.subtotal.toCents(),
      taxAmount: order.taxAmount.toCents(),
      discountAmount: order.discountAmount.toCents(),
      totalAmount: order.totalAmount.toCents(),
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod ?? null,
      paymentReference: order.paymentReference ?? null,
      notes: order.notes ?? null,
      sucursalName: order.sucursalName,
      completedAt: order.completedAt ?? null,
      cancelledAt: order.cancelledAt ?? null,
      cancelledReason: order.cancelledReason ?? null,
    };
    await this.atomically([
      this.db.order.upsert({
        where: { id: order.id },
        create: { id: order.id, ...data, createdAt: order.createdAt },
        update: data,
      }),
      this.db.orderItem.deleteMany({ where: { orderId: order.id } }),
      this.db.orderItem.createMany({
        data: order.items.map((i) => ({
          id: i.id,
          orderId: order.id,
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku ?? null,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toCents(),
          totalPrice: i.totalPrice.toCents(),
          taxRate: i.taxRate,
          taxAmount: i.taxAmount.toCents(),
          notes: i.notes ?? null,
          modifiers: i.modifiers,
          createdAt: i.createdAt,
        })),
      }),
    ]);
  }

  async findByIdAndBusinessId(id: string, businessId: string): Promise<Order | null> {
    const record = await this.db.order.findFirst({ where: { id, businessId }, include: { items: true } });
    return record ? this.toDomain(record) : null;
  }

  async findByBusinessId(businessId: string, filters: OrderListFilters = {}): Promise<Order[]> {
    const records = await this.db.order.findMany({
      where: {
        businessId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.sucursalId ? { sucursalId: filters.sucursalId } : {}),
        ...(filters.from || filters.to
          ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
          : {}),
      },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  // Stored type, status and payment fields were written from the domain values, so they are valid members.
  private toDomain(r: OrderRecord): Order {
    return Order.reconstitute({
      id: r.id,
      businessId: r.businessId,
      sucursalId: r.sucursalId,
      orderNumber: r.orderNumber,
      type: r.type as Order['type'],
      status: r.status as Order['status'],
      tableNumber: r.tableNumber ?? undefined,
      customerName: r.customerName ?? undefined,
      customerPhone: r.customerPhone ?? undefined,
      customerEmail: r.customerEmail ?? undefined,
      deliveryAddress: toAddress(r.deliveryAddress),
      items: (r.items ?? []).map((i) =>
        OrderItem.reconstitute({
          id: i.id,
          orderId: i.orderId,
          productId: i.productId,
          productName: i.productName,
          productSku: i.productSku ?? undefined,
          quantity: i.quantity,
          unitPrice: money(i.unitPrice),
          totalPrice: money(i.totalPrice),
          taxRate: i.taxRate,
          taxAmount: money(i.taxAmount),
          notes: i.notes ?? undefined,
          modifiers: (i.modifiers as LineModifiers | null) ?? [],
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        }),
      ),
      subtotal: money(r.subtotal),
      taxAmount: money(r.taxAmount),
      discountAmount: money(r.discountAmount),
      totalAmount: money(r.totalAmount),
      paymentStatus: r.paymentStatus as Order['paymentStatus'],
      paymentMethod: (r.paymentMethod as Order['paymentMethod'] | null) ?? undefined,
      paymentReference: r.paymentReference ?? undefined,
      notes: r.notes ?? undefined,
      sucursalName: r.sucursalName,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      completedAt: r.completedAt ?? undefined,
      cancelledAt: r.cancelledAt ?? undefined,
      cancelledReason: r.cancelledReason ?? undefined,
    });
  }
}

@Injectable()
export class PrismaOrderRepositoryAdapter extends PrismaOrderRepository {
  constructor(prisma: PrismaService) {
    super(prisma, (writes) => prisma.$transaction(writes));
  }
}

class PrismaPaymentRepository implements PaymentRepositoryPort {
  constructor(private readonly db: Db) {}

  async save(p: PaymentRecord): Promise<void> {
    await this.db.payment.create({
      data: {
        id: p.id,
        orderId: p.orderId,
        businessId: p.businessId,
        amount: p.amount,
        method: p.method,
        status: p.status,
        reference: p.reference ?? null,
        processedAt: p.processedAt ?? null,
        cashSessionId: p.cashSessionId ?? null,
        createdAt: p.createdAt,
      },
    });
  }

  async findByOrderId(orderId: string): Promise<PaymentRecord[]> {
    const records = await this.db.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
    return records.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      businessId: r.businessId,
      amount: r.amount,
      method: r.method,
      status: r.status,
      reference: r.reference ?? undefined,
      processedAt: r.processedAt ?? undefined,
      cashSessionId: r.cashSessionId ?? undefined,
      createdAt: r.createdAt,
    }));
  }
}

@Injectable()
export class PrismaPaymentRepositoryAdapter extends PrismaPaymentRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }
}

class PrismaLockedCashSessions implements LockedCashSessionsPort {
  constructor(private readonly db: Db) {}

  // FOR SHARE lets payments of the same session run side by side but makes a close (FOR UPDATE)
  // wait for them; a payment that waited on a close re-reads the row, sees it closed and gets null.
  async findOpenBySucursalForPayment(businessId: string, sucursalId: string): Promise<{ id: string } | null> {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM cash_sessions
      WHERE "businessId" = ${businessId} AND "sucursalId" = ${sucursalId} AND status = 'open'
      LIMIT 1 FOR SHARE`;
    return rows[0] ?? null;
  }
}

@Injectable()
export class PrismaSalesUnitOfWorkAdapter implements SalesUnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {}

  withOrderLock<T>(orderId: string, businessId: string, work: (repositories: LockedOrderRepositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Row lock held until the transaction ends; a missing order locks nothing and the work reports it.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND "businessId" = ${businessId} FOR UPDATE`;
      return work({
        orders: new PrismaOrderRepository(tx, inOpenTransaction),
        payments: new PrismaPaymentRepository(tx),
        cashSessions: new PrismaLockedCashSessions(tx),
      });
    });
  }
}
