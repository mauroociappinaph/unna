import { Inject, Injectable } from '@nestjs/common';
import { JwtPort, RefreshSessionRecord, RefreshSessionRepositoryPort, Result, TokenPair, User, UserRepositoryPort, err, ok } from '@unna/domain';
import { SESSION_EXPIRED, isSessionOf } from '../session-token';
import { SessionIssuer } from '../session-issuer';

export interface RefreshSessionCommand {
  refreshToken: string;
}

/**
 * Two tabs may race with the same refresh token (the web shares one renewal per tab only). The
 * loser of a race finds the token spent moments ago: within this window it gets 401 without
 * revoking the family, so the winner's tab keeps its session. A replay older than this is treated
 * as a stolen token. The tradeoff: a thief replaying within 10 s of the owner's rotation is only
 * refused, not detected.
 */
export const REUSE_GRACE_MS = 10_000;

/**
 * Renews a session with its single-use refresh token (S21). In one short transaction holding the
 * family lock the presented session must exist, belong to the user, be unused, unrevoked and within
 * the family's absolute lifetime; it is then spent and the next session of the family is created.
 * Presenting a spent token again (after the grace window) revokes the whole family. The user must
 * still exist, be active and have the password the session started with.
 */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
    @Inject('JwtPort')
    private readonly jwtPort: JwtPort,
    @Inject('RefreshSessionRepositoryPort')
    private readonly refreshSessions: RefreshSessionRepositoryPort,
    private readonly sessionIssuer: SessionIssuer,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<Result<{ user: User; tokens: TokenPair }, Error>> {
    const claims = this.jwtPort.verifyRefreshToken(command.refreshToken);
    // A token issued before S21 has no stored session: it is refused once and the user signs in again.
    if (!claims?.jti || !claims.fam) return err(new Error(SESSION_EXPIRED));
    const { jti, fam } = claims;

    const user = await this.userRepository.findById(claims.sub);
    if (!isSessionOf(user, claims)) return err(new Error(SESSION_EXPIRED));

    const next = await this.refreshSessions.withFamilyLock(fam, jti, async ({ head, session }, writes): Promise<RefreshSessionRecord | null> => {
      const now = new Date();
      if (!head || !session || session.userId !== user.id || head.userId !== user.id) return null;
      if (head.revokedAt || session.revokedAt) return null;
      if (session.usedAt) {
        if (now.getTime() - session.usedAt.getTime() >= REUSE_GRACE_MS) await writes.revokeFamily(fam, now);
        return null;
      }
      if (now >= session.expiresAt || this.sessionIssuer.outlived(head, now)) return null;
      const successor = this.sessionIssuer.successor(session, now);
      await writes.markUsed(session.id, successor.id, now);
      await writes.create(successor);
      return successor;
    });
    if (!next) return err(new Error(SESSION_EXPIRED));

    return ok({ user, tokens: this.sessionIssuer.tokensFor(user, next) });
  }
}
