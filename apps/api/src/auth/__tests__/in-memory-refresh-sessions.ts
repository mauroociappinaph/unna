import { LockedRefreshFamily, LockedRefreshSessionWrites, RefreshSessionRecord, RefreshSessionRepositoryPort } from '@unna/domain';

/** Refresh sessions kept in memory; the family lock runs one work at a time, like the row lock. */
export class InMemoryRefreshSessions implements RefreshSessionRepositoryPort {
  readonly byId = new Map<string, RefreshSessionRecord>();
  private queue: Promise<unknown> = Promise.resolve();

  async create(session: RefreshSessionRecord): Promise<void> {
    this.byId.set(session.id, { ...session });
  }

  async revokeAllOfUser(userId: string, at: Date): Promise<void> {
    for (const session of this.byId.values()) {
      if (session.userId === userId && !session.revokedAt) session.revokedAt = at;
    }
  }

  withFamilyLock<T>(
    familyId: string,
    sessionId: string,
    work: (family: LockedRefreshFamily, writes: LockedRefreshSessionWrites) => Promise<T>,
  ): Promise<T> {
    const run = this.queue.then(() => {
      const copy = (id: string) => {
        const found = this.byId.get(id);
        return found && found.familyId === familyId ? { ...found } : null;
      };
      return work({ head: copy(familyId), session: copy(sessionId) }, {
        markUsed: async (id, replacedById, at) => {
          Object.assign(this.byId.get(id) ?? {}, { usedAt: at, replacedById });
        },
        create: (session) => this.create(session),
        revokeFamily: async (family, at) => {
          for (const session of this.byId.values()) {
            if (session.familyId === family && !session.revokedAt) session.revokedAt = at;
          }
        },
      });
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Sessions of a family, oldest first. */
  family(familyId: string): RefreshSessionRecord[] {
    return [...this.byId.values()].filter((session) => session.familyId === familyId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
