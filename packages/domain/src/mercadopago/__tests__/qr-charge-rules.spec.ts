import {
  MERCADOPAGO_PROVISIONING_STALE_MS,
  QR_CHARGE_EXPIRATION,
  QR_CHARGE_TTL_MS,
  qrChargeExternalReference,
  qrChargeStatusFor,
} from '../index';

describe('QR charge rules (S15)', () => {
  it('expires QR orders after 15 minutes, as an ISO 8601 duration for Mercado Pago', () => {
    expect(QR_CHARGE_EXPIRATION).toBe('PT15M');
    expect(QR_CHARGE_TTL_MS).toBe(15 * 60 * 1000);
  });

  it('considers a provisioning claim abandoned after 2 minutes', () => {
    expect(MERCADOPAGO_PROVISIONING_STALE_MS).toBe(2 * 60 * 1000);
  });

  describe('external reference', () => {
    it('joins the order and charge ids without dashes, within 64 chars of [A-Za-z0-9_-]', () => {
      const reference = qrChargeExternalReference('3f2a9c1e-7b4d-4e8a-9f10-1a2b3c4d5e6f', 'aaaabbbb-cccc-4ddd-8eee-ffff00001111');
      expect(reference).toBe('3f2a9c1e7b4d4e8a9f101a2b3c4d5e6f-aaaabbbbcccc4ddd8eeeffff0000111');
      expect(reference).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    });

    it('drops anything outside the allowed characters', () => {
      expect(qrChargeExternalReference('ord 1/é', 'ch#2')).toBe('ord1-ch2');
    });
  });

  describe('status of the charge for a Mercado Pago order status', () => {
    it.each([
      ['processed', 'paid'],
      ['expired', 'expired'],
      ['canceled', 'cancelled'],
      ['refunded', 'cancelled'],
    ] as const)('%s → %s', (mpStatus, status) => {
      expect(qrChargeStatusFor(mpStatus)).toBe(status);
    });

    it.each(['created', 'action_required', 'unknown'] as const)('%s keeps the charge pending (null)', (mpStatus) => {
      expect(qrChargeStatusFor(mpStatus)).toBeNull();
    });
  });
});
