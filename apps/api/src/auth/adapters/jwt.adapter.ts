import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPort, JwtPayload, TokenPair, ResetTokenPayload } from '@unna/domain';
import { JwtSecrets, jwtSecretsFrom } from '../../common/jwt-secrets';
import { ACCESS_TOKEN_TYPE, REFRESH_TOKEN_TYPE } from '../session-token';

/**
 * Each token type has its own secret and a `type` claim (access, refresh, password_reset,
 * email_verification): verifying checks both, so no token is accepted as another kind.
 */
@Injectable()
export class JwtAdapter implements JwtPort {
  private readonly secrets: JwtSecrets;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.secrets = jwtSecretsFrom(configService);
  }

  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign({ ...payload, type: ACCESS_TOKEN_TYPE }, {
      secret: this.secrets.access,
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
    });
  }

  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign({ ...payload, type: REFRESH_TOKEN_TYPE }, {
      secret: this.secrets.refresh,
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });
  }

  generateTokenPair(payload: JwtPayload): TokenPair {
    // The session (`jti`) and family (`fam`) of a single-use refresh token stay out of the access token.
    const accessClaims: JwtPayload = { ...payload };
    delete accessClaims.jti;
    delete accessClaims.fam;
    const accessToken = this.generateAccessToken(accessClaims);
    const refreshToken = this.generateRefreshToken(payload);
    const decoded = this.jwtService.decode(accessToken) as JwtPayload & { exp: number };
    const expiresIn = decoded.exp * 1000 - Date.now();

    return { accessToken, refreshToken, expiresIn };
  }

  verifyAccessToken(token: string): JwtPayload | null {
    return this.verifyTyped(token, this.secrets.access, ACCESS_TOKEN_TYPE);
  }

  verifyRefreshToken(token: string): JwtPayload | null {
    return this.verifyTyped(token, this.secrets.refresh, REFRESH_TOKEN_TYPE);
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token) as JwtPayload | null;
    } catch {
      return null;
    }
  }

  generateResetToken(payload: ResetTokenPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.secrets.reset,
      expiresIn: '1h',
    });
  }

  verifyResetToken(token: string): ResetTokenPayload {
    try {
      return this.jwtService.verify<ResetTokenPayload>(token, { secret: this.secrets.reset });
    } catch {
      throw new Error('Token inválido o expirado');
    }
  }

  private verifyTyped(token: string, secret: string, type: string): JwtPayload | null {
    try {
      const claims = this.jwtService.verify<JwtPayload & { type?: string }>(token, { secret });
      return claims.type === type ? claims : null;
    } catch {
      return null;
    }
  }
}
