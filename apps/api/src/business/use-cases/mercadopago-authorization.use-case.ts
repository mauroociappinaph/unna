import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  isWellFormedOAuthState,
  MERCADOPAGO_OAUTH_ATTEMPT_TTL_MS,
  MercadoPagoConnectionRepositoryPort,
  MercadoPagoGatewayPort,
  SecretCipherPort,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

export type MercadoPagoCallbackOutcome = 'connected' | 'error';

export interface MercadoPagoCallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

const base64url32 = () => randomBytes(32).toString('base64url');

/** Only the SHA-256 of an OAuth state is stored; the callback hashes the state it receives. */
export const hashOAuthState = (state: string): string => createHash('sha256').update(state).digest('hex');
/** PKCE S256 challenge of a verifier. */
export const pkceChallenge = (verifier: string): string => createHash('sha256').update(verifier).digest('base64url');

/**
 * "Conectar con Mercado Pago" (S15): OAuth authorization code with PKCE. Each attempt has a random
 * state, stored hashed with its encrypted verifier, bound to the business and owner, single use and
 * valid for 10 minutes. The callback never reports why it failed.
 */
@Injectable()
export class MercadoPagoAuthorizationUseCase {
  constructor(
    @Inject('MercadoPagoConnectionRepositoryPort')
    private readonly repository: MercadoPagoConnectionRepositoryPort,
    @Inject('MercadoPagoGatewayPort')
    private readonly gateway: MercadoPagoGatewayPort,
    @Inject('SecretCipherPort')
    private readonly cipher: SecretCipherPort,
  ) {}

  async connect(businessId: string, ownerId: string, now = new Date()): Promise<UseCaseResult<{ authorizationUrl: string }>> {
    await this.repository.deleteExpiredOAuthAttempts(now);
    const state = base64url32();
    const codeVerifier = base64url32();
    await this.repository.saveOAuthAttempt({
      stateHash: hashOAuthState(state),
      businessId,
      ownerId,
      encryptedCodeVerifier: this.cipher.encrypt(codeVerifier),
      expiresAt: new Date(now.getTime() + MERCADOPAGO_OAUTH_ATTEMPT_TTL_MS),
    });
    return { ok: true, value: { authorizationUrl: this.gateway.buildAuthorizationUrl({ state, codeChallenge: pkceChallenge(codeVerifier) }) } };
  }

  /** Consumes the attempt, exchanges the code and stores the tokens encrypted. Never throws. */
  async complete(query: MercadoPagoCallbackQuery, now = new Date()): Promise<MercadoPagoCallbackOutcome> {
    try {
      if (!isWellFormedOAuthState(query.state)) return 'error';
      const attempt = await this.repository.consumeOAuthAttempt(hashOAuthState(query.state));
      if (!attempt || attempt.expiresAt <= now) return 'error';
      if (query.error || !query.code) return 'error';
      if ((await this.repository.findBusinessOwnerId(attempt.businessId)) !== attempt.ownerId) return 'error';

      const tokens = await this.gateway.exchangeCode({ code: query.code, codeVerifier: this.cipher.decrypt(attempt.encryptedCodeVerifier) });
      await this.repository.saveConnection({
        businessId: attempt.businessId,
        mpUserId: tokens.mpUserId,
        liveMode: tokens.liveMode,
        scope: tokens.scope,
        encryptedAccessToken: this.cipher.encrypt(tokens.accessToken),
        encryptedRefreshToken: this.cipher.encrypt(tokens.refreshToken),
        accessTokenExpiresAt: new Date(now.getTime() + tokens.expiresInSeconds * 1000),
        connectedAt: now,
      });
      return 'connected';
    } catch {
      // The cause (Mercado Pago rejection, decryption, database) is not exposed to the browser.
      return 'error';
    }
  }
}
