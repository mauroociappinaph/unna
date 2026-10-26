import {
  CreateMercadoPagoPosRequest,
  CreateMercadoPagoQrOrderRequest,
  CreateMercadoPagoStoreRequest,
  MercadoPagoGatewayPort,
  MercadoPagoOrder,
  MercadoPagoOrderStatus,
  MercadoPagoPos,
  MercadoPagoTokens,
} from '@unna/domain';
import type { MercadoPagoConfig } from './mercadopago.config';

const AUTHORIZATION_URL = 'https://auth.mercadopago.com/authorization';
const API_URL = 'https://api.mercadopago.com';
const DEFAULT_TIMEOUT_MS = 15000;
const ORDER_STATUSES: readonly MercadoPagoOrderStatus[] = ['created', 'processed', 'refunded', 'expired', 'canceled', 'action_required'];
// Only short machine codes (invalid_grant, order_already_canceled...) make it into error messages.
const ERROR_CODE = /^[A-Za-z0-9_]{1,64}$/;

type Json = Record<string, unknown>;

/** Integer cents to Mercado Pago's decimal string ("50.00"). */
export function toMercadoPagoAmount(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(Math.abs(cents % 100)).padStart(2, '0')}`;
}

export function fromMercadoPagoAmount(amount: unknown): number {
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/**
 * Mercado Pago over HTTPS with global fetch (OAuth + PKCE, stores, POS, Orders API type "qr").
 * Tokens travel only in headers and bodies; errors carry the HTTP status and Mercado Pago's error
 * code, never tokens, secrets or response text.
 */
export class MercadoPagoHttpAdapter implements MercadoPagoGatewayPort {
  constructor(
    private readonly config: MercadoPagoConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  buildAuthorizationUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      platform_id: 'mp',
      state,
      redirect_uri: this.config.redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    return `${AUTHORIZATION_URL}?${params}`;
  }

  async exchangeCode({ code, codeVerifier }: { code: string; codeVerifier: string }): Promise<MercadoPagoTokens> {
    return toTokens(await this.request('POST', '/oauth/token', {
      body: {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier,
      },
    }));
  }

  async refreshToken(refreshToken: string): Promise<MercadoPagoTokens> {
    return toTokens(await this.request('POST', '/oauth/token', {
      body: { client_id: this.config.clientId, client_secret: this.config.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken },
    }));
  }

  async createStore(accessToken: string, request: CreateMercadoPagoStoreRequest): Promise<{ id: string }> {
    const { location } = request;
    const response = await this.request('POST', `/users/${encodeURIComponent(request.mpUserId)}/stores`, {
      accessToken,
      body: {
        name: request.name,
        external_id: request.externalId,
        location: {
          street_name: location.streetName,
          street_number: location.streetNumber,
          city_name: location.cityName,
          state_name: location.stateName,
          ...(location.reference !== undefined && { reference: location.reference }),
          ...(location.latitude !== undefined && { latitude: location.latitude }),
          ...(location.longitude !== undefined && { longitude: location.longitude }),
        },
      },
    });
    return { id: String(response.id) };
  }

  async createPos(accessToken: string, request: CreateMercadoPagoPosRequest): Promise<MercadoPagoPos> {
    const response = await this.request('POST', '/v2/pos', {
      accessToken,
      idempotencyKey: request.idempotencyKey,
      body: {
        name: request.name,
        store_id: /^\d+$/.test(request.storeId) ? Number(request.storeId) : request.storeId,
        external_id: request.externalId,
        config: { qr: { operating_mode: 'pdv' } },
      },
    });
    const qr = (response.qr_response ?? response.qr ?? {}) as Json;
    return {
      id: String(response.id),
      externalId: String(response.external_id ?? request.externalId),
      qrImageUrl: String(qr.image ?? ''),
      qrTemplateUrl: String(qr.template_document ?? ''),
    };
  }

  async createQrOrder(accessToken: string, request: CreateMercadoPagoQrOrderRequest): Promise<MercadoPagoOrder> {
    const amount = toMercadoPagoAmount(request.amount);
    return toOrder(await this.request('POST', '/v1/orders', {
      accessToken,
      idempotencyKey: request.idempotencyKey,
      body: {
        type: 'qr',
        external_reference: request.externalReference,
        total_amount: amount,
        description: request.description,
        expiration_time: request.expirationTime,
        config: { qr: { external_pos_id: request.externalPosId, mode: 'hybrid' } },
        transactions: { payments: [{ amount }] },
      },
    }));
  }

  async getOrder(accessToken: string, orderId: string): Promise<MercadoPagoOrder> {
    return toOrder(await this.request('GET', `/v1/orders/${encodeURIComponent(orderId)}`, { accessToken }));
  }

  async cancelOrder(accessToken: string, orderId: string, idempotencyKey: string): Promise<MercadoPagoOrder> {
    return toOrder(await this.request('POST', `/v1/orders/${encodeURIComponent(orderId)}/cancel`, { accessToken, idempotencyKey }));
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    options: { accessToken?: string; idempotencyKey?: string; body?: Json },
  ): Promise<Json> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
    if (options.idempotencyKey) headers['X-Idempotency-Key'] = options.idempotencyKey;

    let response: Response;
    try {
      response = await this.fetchImpl(`${API_URL}${path}`, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch {
      throw new Error('No se pudo conectar con Mercado Pago');
    }
    const payload = (await response.json().catch(() => ({}))) as Json;
    if (!response.ok) throw new Error(`Mercado Pago respondió ${response.status}${errorCode(payload)}`);
    return payload;
  }
}

function errorCode(payload: Json): string {
  const errors = Array.isArray(payload.errors) ? (payload.errors as Json[]) : [];
  const code = payload.error ?? payload.code ?? errors[0]?.code;
  return typeof code === 'string' && ERROR_CODE.test(code) ? ` (${code})` : '';
}

function toTokens(response: Json): MercadoPagoTokens {
  return {
    accessToken: String(response.access_token),
    refreshToken: String(response.refresh_token),
    expiresInSeconds: Number(response.expires_in),
    scope: String(response.scope ?? ''),
    mpUserId: String(response.user_id),
    liveMode: response.live_mode === true,
  };
}

function toOrder(response: Json): MercadoPagoOrder {
  const payments = ((response.transactions as Json | undefined)?.payments ?? []) as Json[];
  const status = String(response.status) as MercadoPagoOrderStatus;
  const qrData = (response.type_response as Json | undefined)?.qr_data;
  return {
    id: String(response.id),
    status: ORDER_STATUSES.includes(status) ? status : 'unknown',
    statusDetail: typeof response.status_detail === 'string' ? response.status_detail : null,
    externalReference: typeof response.external_reference === 'string' ? response.external_reference : null,
    totalAmount: fromMercadoPagoAmount(response.total_amount),
    paymentId: payments[0]?.id !== undefined ? String(payments[0].id) : null,
    qrData: typeof qrData === 'string' ? qrData : null,
  };
}
