const DAY_MS = 24 * 60 * 60 * 1000;

/** A started "Conectar con Mercado Pago" attempt (its state) is valid for 10 minutes, once. */
export const MERCADOPAGO_OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1000;

/** Access tokens last 180 days; UNNA refreshes them when they expire within this window. */
export const MERCADOPAGO_TOKEN_REFRESH_WINDOW_MS = 7 * DAY_MS;

const STORE_EXTERNAL_ID_MAX = 60;
const POS_EXTERNAL_ID_MAX = 40;
// 32 random bytes in base64url, without padding.
const OAUTH_STATE = /^[A-Za-z0-9_-]{43}$/;

export interface MercadoPagoExternalIds {
  storeExternalId: string;
  posExternalId: string;
}

/**
 * External ids of the sucursal's store (alphanumeric, ≤60) and POS (≤40, referenced by QR orders),
 * derived from the UNNA sucursal id so they are stable across retries.
 */
export function mercadoPagoExternalIds(sucursalId: string): MercadoPagoExternalIds {
  const alphanumeric = sucursalId.replace(/[^A-Za-z0-9]/g, '');
  return {
    storeExternalId: `UNNAS${alphanumeric}`.slice(0, STORE_EXTERNAL_ID_MAX),
    posExternalId: `UNNAP${alphanumeric}`.slice(0, POS_EXTERNAL_ID_MAX),
  };
}

export function shouldRefreshMercadoPagoToken(accessTokenExpiresAt: Date, now: Date): boolean {
  return accessTokenExpiresAt.getTime() - now.getTime() <= MERCADOPAGO_TOKEN_REFRESH_WINDOW_MS;
}

/** Malformed states are rejected before any lookup. */
export function isWellFormedOAuthState(state: string | undefined | null): state is string {
  return typeof state === 'string' && OAUTH_STATE.test(state);
}
