import {
  isWellFormedOAuthState,
  MERCADOPAGO_OAUTH_ATTEMPT_TTL_MS,
  mercadoPagoExternalIds,
  shouldRefreshMercadoPagoToken,
} from '../index';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Mercado Pago rules (S15)', () => {
  describe('external ids of the store and POS', () => {
    it('derives both from the sucursal id: alphanumeric, distinct, within 60 (store) and 40 (POS) chars', () => {
      const ids = mercadoPagoExternalIds('3f2a9c1e-7b4d-4e8a-9f10-1a2b3c4d5e6f');
      expect(ids).toEqual({ storeExternalId: 'UNNAS3f2a9c1e7b4d4e8a9f101a2b3c4d5e6f', posExternalId: 'UNNAP3f2a9c1e7b4d4e8a9f101a2b3c4d5e6f' });
      expect(ids.storeExternalId).toMatch(/^[A-Za-z0-9]{1,60}$/);
      expect(ids.posExternalId).toMatch(/^[A-Za-z0-9]{1,40}$/);
    });

    it('drops non-alphanumeric characters and truncates long ids to the limits', () => {
      const ids = mercadoPagoExternalIds(`suc_${'x'.repeat(80)}`);
      expect(ids.storeExternalId).toHaveLength(60);
      expect(ids.posExternalId).toHaveLength(40);
      expect(ids.posExternalId).toMatch(/^UNNAPsucx+$/);
    });
  });

  describe('token refresh window', () => {
    const now = new Date('2026-10-25T12:00:00Z');

    it('refreshes when the access token expires within 7 days (boundary included) or already expired', () => {
      expect(shouldRefreshMercadoPagoToken(new Date(now.getTime() + 7 * DAY_MS), now)).toBe(true);
      expect(shouldRefreshMercadoPagoToken(new Date(now.getTime() + DAY_MS), now)).toBe(true);
      expect(shouldRefreshMercadoPagoToken(new Date(now.getTime() - DAY_MS), now)).toBe(true);
    });

    it('keeps the token when it expires later than 7 days from now', () => {
      expect(shouldRefreshMercadoPagoToken(new Date(now.getTime() + 7 * DAY_MS + 1), now)).toBe(false);
    });
  });

  describe('OAuth attempt', () => {
    it('lasts 10 minutes', () => {
      expect(MERCADOPAGO_OAUTH_ATTEMPT_TTL_MS).toBe(10 * 60 * 1000);
    });

    it('accepts only 43-char base64url states', () => {
      expect(isWellFormedOAuthState('A'.repeat(43))).toBe(true);
      expect(isWellFormedOAuthState('a-_9'.repeat(10) + 'abc')).toBe(true);
      expect(isWellFormedOAuthState('A'.repeat(42))).toBe(false);
      expect(isWellFormedOAuthState('A'.repeat(42) + '=')).toBe(false);
      expect(isWellFormedOAuthState(undefined)).toBe(false);
      expect(isWellFormedOAuthState('')).toBe(false);
    });
  });
});
