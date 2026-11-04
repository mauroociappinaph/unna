import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtPort, RefreshSessionRecord, RefreshSessionRepositoryPort, TokenPair, User } from '@unna/domain';
import { sessionClaims } from './session-token';

export const DEFAULT_SESSION_MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function sessionMaxAgeMs(config: ConfigService): number {
  const raw = config.get<string>('SESSION_MAX_DAYS');
  if (raw === undefined || raw === '') return DEFAULT_SESSION_MAX_DAYS * DAY_MS;
  const days = Number(raw);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`SESSION_MAX_DAYS tiene que ser un número de días mayor a 0 (por defecto ${DEFAULT_SESSION_MAX_DAYS})`);
  }
  return days * DAY_MS;
}

/**
 * Issues the session tokens backed by stored refresh sessions (S21). A login starts a family whose
 * id is its first session's id; each refresh token carries its session (`jti`) and family (`fam`).
 * A family lives at most SESSION_MAX_DAYS (30 by default) from the login, however often it refreshes.
 */
@Injectable()
export class SessionIssuer {
  private readonly maxAgeMs: number;

  constructor(
    @Inject('JwtPort')
    private readonly jwtPort: JwtPort,
    @Inject('RefreshSessionRepositoryPort')
    private readonly sessions: RefreshSessionRepositoryPort,
    configService: ConfigService,
  ) {
    this.maxAgeMs = sessionMaxAgeMs(configService);
  }

  /** Starts a new family for the user (login, register) and returns its first pair. */
  async start(user: User, now = new Date()): Promise<TokenPair> {
    const id = randomUUID();
    const first: RefreshSessionRecord = {
      id, userId: user.id, familyId: id, createdAt: now, expiresAt: new Date(now.getTime() + this.maxAgeMs),
      usedAt: null, revokedAt: null, replacedById: null,
    };
    await this.sessions.create(first);
    return this.tokensFor(user, first);
  }

  /** The session that replaces `session` in its family; it keeps the family's deadline. */
  successor(session: RefreshSessionRecord, now: Date): RefreshSessionRecord {
    return {
      id: randomUUID(), userId: session.userId, familyId: session.familyId, createdAt: now, expiresAt: session.expiresAt,
      usedAt: null, revokedAt: null, replacedById: null,
    };
  }

  /** Whether the family that started with `head` is past its absolute lifetime. */
  outlived(head: RefreshSessionRecord, now: Date): boolean {
    return now.getTime() >= head.createdAt.getTime() + this.maxAgeMs;
  }

  tokensFor(user: User, session: RefreshSessionRecord): TokenPair {
    return this.jwtPort.generateTokenPair({ ...sessionClaims(user), jti: session.id, fam: session.familyId });
  }
}
