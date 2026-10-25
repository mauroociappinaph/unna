import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CashAmounts,
  CashSession,
  CashSessionListFilters,
  CashSessionPayment,
  CashSessionRepositoryPort,
  CashUnitOfWorkPort,
} from '@unna/domain';
import { AtomicWrites, Db, inOpenTransaction } from './sales.repository.adapter';

type CashSessionRecord = Prisma.CashSessionGetPayload<{ include: { movements: true } }>;

const withMovements = { movements: { orderBy: { createdAt: 'asc' } } } satisfies Prisma.CashSessionInclude;

/** Amount columns were written from CashAmounts by `save`. */
const toAmounts = (json: Prisma.JsonValue | null): CashAmounts | undefined =>
  json ? (json as unknown as CashAmounts) : undefined;

class PrismaCashSessionRepository implements CashSessionRepositoryPort {
  constructor(
    private readonly db: Db,
    private readonly atomically: AtomicWrites,
  ) {}

  async findOpenBySucursal(businessId: string, sucursalId: string): Promise<CashSession | null> {
    const record = await this.db.cashSession.findFirst({
      where: { businessId, sucursalId, status: 'open' },
      include: withMovements,
    });
    return record ? this.toDomain(record) : null;
  }

  async findByIdAndBusinessId(id: string, businessId: string): Promise<CashSession | null> {
    const record = await this.db.cashSession.findFirst({ where: { id, businessId }, include: withMovements });
    return record ? this.toDomain(record) : null;
  }

  async listByBusiness(businessId: string, filters: CashSessionListFilters = {}): Promise<CashSession[]> {
    const records = await this.db.cashSession.findMany({
      where: {
        businessId,
        ...(filters.sucursalId ? { sucursalId: filters.sucursalId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.from || filters.to
          ? { openedAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
          : {}),
      },
      include: withMovements,
      orderBy: { openedAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findPaymentsBySession(sessionId: string): Promise<CashSessionPayment[]> {
    return this.db.payment.findMany({ where: { cashSessionId: sessionId }, select: { method: true, amount: true, status: true } });
  }

  async save(session: CashSession): Promise<void> {
    const data = {
      businessId: session.businessId,
      sucursalId: session.sucursalId,
      status: session.status,
      openedBy: session.openedBy,
      openedAt: session.openedAt,
      openingAmount: session.openingAmount,
      closedBy: session.closedBy ?? null,
      closedAt: session.closedAt ?? null,
      expected: session.expected ? { ...session.expected } : undefined,
      declared: session.declared ? { ...session.declared } : undefined,
      difference: session.difference ? { ...session.difference } : undefined,
      notes: session.notes ?? null,
    };
    await this.atomically([
      this.db.cashSession.upsert({ where: { id: session.id }, create: { id: session.id, ...data }, update: data }),
      // Movements are append-only: stored ones are skipped, new ones are inserted.
      this.db.cashMovement.createMany({
        data: session.movements.map((m) => ({
          id: m.id,
          sessionId: session.id,
          businessId: session.businessId,
          type: m.type,
          amount: m.amount,
          reason: m.reason,
          createdBy: m.createdBy,
          createdAt: m.createdAt,
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  // Stored status and movement types were written from the domain values, so they are valid members.
  private toDomain(r: CashSessionRecord): CashSession {
    return CashSession.reconstitute({
      id: r.id,
      businessId: r.businessId,
      sucursalId: r.sucursalId,
      status: r.status as CashSession['status'],
      openedBy: r.openedBy,
      openedAt: r.openedAt,
      openingAmount: r.openingAmount,
      movements: r.movements.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        type: m.type as CashSession['movements'][number]['type'],
        amount: m.amount,
        reason: m.reason,
        createdBy: m.createdBy,
        createdAt: m.createdAt,
      })),
      closedBy: r.closedBy ?? undefined,
      closedAt: r.closedAt ?? undefined,
      expected: toAmounts(r.expected),
      declared: toAmounts(r.declared),
      difference: toAmounts(r.difference),
      notes: r.notes ?? undefined,
    });
  }
}

@Injectable()
export class PrismaCashSessionRepositoryAdapter extends PrismaCashSessionRepository {
  constructor(prisma: PrismaService) {
    super(prisma, (writes) => prisma.$transaction(writes));
  }
}

@Injectable()
export class PrismaCashUnitOfWorkAdapter implements CashUnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {}

  // NO KEY UPDATE serializes openings for the sucursal without blocking orders that reference it.
  withSucursalLock<T>(businessId: string, sucursalId: string, work: (sessions: CashSessionRepositoryPort) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sucursales WHERE id = ${sucursalId} AND "businessId" = ${businessId} FOR NO KEY UPDATE`;
      return work(new PrismaCashSessionRepository(tx, inOpenTransaction));
    });
  }

  // FOR UPDATE conflicts with the FOR SHARE that payments take on the session (see PrismaLockedCashSessions).
  withSessionLock<T>(sessionId: string, businessId: string, work: (sessions: CashSessionRepositoryPort) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cash_sessions WHERE id = ${sessionId} AND "businessId" = ${businessId} FOR UPDATE`;
      return work(new PrismaCashSessionRepository(tx, inOpenTransaction));
    });
  }
}
