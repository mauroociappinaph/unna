import { Inject, Injectable } from '@nestjs/common';
import { JwtPort, Result, TokenPair, User, UserRepositoryPort, err, ok } from '@unna/domain';
import { SESSION_EXPIRED, isSessionOf, sessionClaims } from '../session-token';

export interface RefreshSessionCommand {
  refreshToken: string;
}

/**
 * Renews a session with its refresh token: a fresh access/refresh pair for a user that still
 * exists, is active and has not changed the password since the session started.
 */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
    @Inject('JwtPort')
    private readonly jwtPort: JwtPort,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<Result<{ user: User; tokens: TokenPair }, Error>> {
    const claims = this.jwtPort.verifyRefreshToken(command.refreshToken);
    if (!claims) return err(new Error(SESSION_EXPIRED));

    const user = await this.userRepository.findById(claims.sub);
    if (!isSessionOf(user, claims)) return err(new Error(SESSION_EXPIRED));

    return ok({ user, tokens: this.jwtPort.generateTokenPair(sessionClaims(user)) });
  }
}
