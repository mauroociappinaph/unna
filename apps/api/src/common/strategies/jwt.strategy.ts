import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload, UserRepositoryPort } from '@unna/domain';
import { jwtSecretsFrom } from '../jwt-secrets';
import { ACCESS_TOKEN_TYPE, isSessionOf } from '../../auth/session-token';

/**
 * Accepts only access tokens (never refresh, reset or verification tokens) of a session that is
 * still valid: the user exists, is active and has not changed the password since signing in. That
 * costs one lookup by primary key per authenticated request, and in exchange a password change or a
 * deactivation ends every open session at once instead of when the access token expires.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject('UserRepositoryPort')
    private readonly userRepository: UserRepositoryPort,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecretsFrom(configService).access,
    });
  }

  async validate(payload: Partial<JwtPayload> & { type?: string }) {
    if (payload.type !== ACCESS_TOKEN_TYPE || !payload.sub || !payload.email) {
      throw new UnauthorizedException('Token inválido');
    }
    const user = await this.userRepository.findById(payload.sub);
    if (!isSessionOf(user, payload)) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    return payload;
  }
}
