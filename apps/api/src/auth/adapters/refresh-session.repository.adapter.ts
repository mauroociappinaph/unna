import { Injectable } from '@nestjs/common';
import { LockedRefreshFamily, LockedRefreshSessionWrites, RefreshSessionRecord, RefreshSessionRepositoryPort } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Refresh sessions in `refresh_sessions` (S21). Every refresh of a family first locks the family's
 * first session (its id is the family id), so the rotations and the revocation of one family run one
 * after another, and a revocation sees the sessions created by a rotation that finished before it.
 * Each transaction is short and calls nothing external (S18).
 */
@Injectable()
export class PrismaRefreshSessionRepository implements RefreshSessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(session: RefreshSessionRecord): Promise<void> {
    await this.prisma.refreshSession.create({ data: session });
  }

  async revokeAllOfUser(userId: string, at: Date): Promise<void> {
    await this.prisma.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: at } });
  }

  withFamilyLock<T>(
    familyId: string,
    sessionId: string,
    work: (family: LockedRefreshFamily, writes: LockedRefreshSessionWrites) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Always the family head first, then the presented session: one lock order, no deadlocks.
      await tx.$queryRaw`SELECT id FROM refresh_sessions WHERE id = ${familyId} FOR UPDATE`;
      if (sessionId !== familyId) await tx.$queryRaw`SELECT id FROM refresh_sessions WHERE id = ${sessionId} FOR UPDATE`;
      const rows = await tx.refreshSession.findMany({ where: { id: { in: [familyId, sessionId] }, familyId } });
      const find = (id: string) => rows.find((row) => row.id === id) ?? null;
      return work({ head: find(familyId), session: find(sessionId) }, {
        markUsed: async (id, replacedById, at) => {
          await tx.refreshSession.update({ where: { id }, data: { usedAt: at, replacedById } });
        },
        create: async (session) => {
          await tx.refreshSession.create({ data: session });
        },
        revokeFamily: async (family, at) => {
          await tx.refreshSession.updateMany({ where: { familyId: family, revokedAt: null }, data: { revokedAt: at } });
        },
      });
    });
  }
}
