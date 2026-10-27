// Single-use refresh tokens (S21): each refresh token is one stored session; using it spends it and
// creates the next one of the same family (one family per login). Only the token's `jti` is stored.

export interface RefreshSessionRecord {
  /** The refresh token's `jti`. */
  id: string;
  userId: string;
  /** Id of the family's first session: one family per login. */
  familyId: string;
  createdAt: Date;
  /** End of the family's absolute lifetime; no refresh is accepted after it. */
  expiresAt: Date;
  /** When the token was spent for the next one; a second use is a reuse. */
  usedAt: Date | null;
  revokedAt: Date | null;
  replacedById: string | null;
}

/** The family's first session (its lock and creation date) and the presented session, read under the lock. */
export interface LockedRefreshFamily {
  head: RefreshSessionRecord | null;
  session: RefreshSessionRecord | null;
}

/** Writes that commit together with the transaction holding the family lock. */
export interface LockedRefreshSessionWrites {
  markUsed(sessionId: string, replacedById: string, at: Date): Promise<void>;
  create(session: RefreshSessionRecord): Promise<void>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
}

export interface RefreshSessionRepositoryPort {
  /** Stores the first session of a new family (login, register). */
  create(session: RefreshSessionRecord): Promise<void>;
  /** Revokes every family of the user (password reset). */
  revokeAllOfUser(userId: string, at: Date): Promise<void>;
  /**
   * Runs `work` in one short transaction holding a lock on the family's first session, then on the
   * presented one, so the refreshes and the revocation of a family run one after another. The writes
   * commit together or not at all.
   */
  withFamilyLock<T>(
    familyId: string,
    sessionId: string,
    work: (family: LockedRefreshFamily, writes: LockedRefreshSessionWrites) => Promise<T>,
  ): Promise<T>;
}
