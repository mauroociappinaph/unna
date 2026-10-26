import { Inject, Injectable } from '@nestjs/common';
import {
  MercadoPagoConnectionRecord,
  MercadoPagoConnectionRepositoryPort,
  MercadoPagoGatewayPort,
  MercadoPagoTokens,
  SecretCipherPort,
  shouldRefreshMercadoPagoToken,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

export const MERCADOPAGO_NOT_CONNECTED = 'Conectá tu cuenta de Mercado Pago';
const REFRESH_FAILED = 'No se pudo renovar la conexión con Mercado Pago: volvé a conectar la cuenta';

/**
 * Valid seller access token of a business (S15). Refreshes it when it expires within 7 days and
 * stores the new refresh token, since each one works once. Concurrent callers in this process share
 * one refresh per business.
 */
@Injectable()
export class MercadoPagoAccessTokenProvider {
  private readonly refreshing = new Map<string, Promise<UseCaseResult<string>>>();

  constructor(
    @Inject('MercadoPagoConnectionRepositoryPort')
    private readonly repository: MercadoPagoConnectionRepositoryPort,
    @Inject('MercadoPagoGatewayPort')
    private readonly gateway: MercadoPagoGatewayPort,
    @Inject('SecretCipherPort')
    private readonly cipher: SecretCipherPort,
  ) {}

  async validAccessToken(businessId: string, now = new Date()): Promise<UseCaseResult<string>> {
    const inFlight = this.refreshing.get(businessId);
    if (inFlight) return inFlight;

    const connection = await this.repository.findConnection(businessId);
    if (!connection) return { ok: false, error: new Error(MERCADOPAGO_NOT_CONNECTED) };
    if (!shouldRefreshMercadoPagoToken(connection.accessTokenExpiresAt, now)) {
      return { ok: true, value: this.cipher.decrypt(connection.encryptedAccessToken) };
    }

    const again = this.refreshing.get(businessId);
    if (again) return again;
    const refresh = this.refresh(connection, now).finally(() => this.refreshing.delete(businessId));
    this.refreshing.set(businessId, refresh);
    return refresh;
  }

  private async refresh(connection: MercadoPagoConnectionRecord, now: Date): Promise<UseCaseResult<string>> {
    let tokens: MercadoPagoTokens;
    try {
      tokens = await this.gateway.refreshToken(this.cipher.decrypt(connection.encryptedRefreshToken));
    } catch {
      return { ok: false, error: new Error(REFRESH_FAILED) };
    }
    await this.repository.updateTokens(connection.businessId, {
      encryptedAccessToken: this.cipher.encrypt(tokens.accessToken),
      encryptedRefreshToken: this.cipher.encrypt(tokens.refreshToken),
      accessTokenExpiresAt: new Date(now.getTime() + tokens.expiresInSeconds * 1000),
      scope: tokens.scope,
    });
    return { ok: true, value: tokens.accessToken };
  }
}
