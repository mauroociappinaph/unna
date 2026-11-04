import {
  argentinaClock,
  estimatedPreparationMinutes,
  isWellFormedPreorderSlug,
  isWellFormedTrackingToken,
  onlineCheckoutExternalReference,
  onlineCheckoutStatusFor,
  PREORDER_CHECKOUT_EXPIRATION,
  PREORDER_CHECKOUT_TTL_MS,
  PREORDER_CLOSED,
  PREORDER_MAX_LINES,
  PREORDER_MAX_QUANTITY,
  PREORDER_NOT_RECEIVING,
  preorderNotAcceptingReason,
  preorderTrackingStatus,
  Schedule,
} from '../../index';

describe('pedido anticipado rules (S20)', () => {
  it('expires checkouts after 15 minutes, as an ISO 8601 duration for Mercado Pago', () => {
    expect(PREORDER_CHECKOUT_EXPIRATION).toBe('PT15M');
    expect(PREORDER_CHECKOUT_TTL_MS).toBe(15 * 60 * 1000);
  });

  it('limits a cart to 30 lines of 1 to 20 units', () => {
    expect(PREORDER_MAX_LINES).toBe(30);
    expect(PREORDER_MAX_QUANTITY).toBe(20);
  });

  describe('argentinaClock', () => {
    it('gives the Argentine weekday and HH:mm (UTC-3, no daylight saving)', () => {
      // Monday 2026-10-26 02:30 UTC is Sunday 23:30 in Argentina.
      expect(argentinaClock(new Date('2026-10-26T02:30:00Z'))).toEqual({ day: 'sunday', time: '23:30' });
      expect(argentinaClock(new Date('2026-10-26T12:05:00Z'))).toEqual({ day: 'monday', time: '09:05' });
    });

    it('feeds Schedule.isOpenAt', () => {
      const schedule = Schedule.create({ monday: { open: '08:00', close: '20:00', isClosed: false } });
      const at = (iso: string) => {
        const { day, time } = argentinaClock(new Date(iso));
        return schedule.isOpenAt(day, time);
      };
      expect(at('2026-10-26T11:00:00Z')).toBe(true); // 08:00
      expect(at('2026-10-26T10:59:00Z')).toBe(false); // 07:59
      expect(at('2026-10-26T23:00:00Z')).toBe(false); // 20:00
    });
  });

  describe('preorderNotAcceptingReason', () => {
    const open = { active: true, open: true, cashOpen: true, mercadoPagoConnected: true };

    it('is null when the local is active, open, with caja open and Mercado Pago connected', () => {
      expect(preorderNotAcceptingReason(open)).toBeNull();
    });

    it.each([
      ['an inactive sucursal', { active: false }, PREORDER_NOT_RECEIVING],
      ['a closed schedule', { open: false }, PREORDER_CLOSED],
      ['a closed caja', { cashOpen: false }, PREORDER_NOT_RECEIVING],
      ['Mercado Pago not connected', { mercadoPagoConnected: false }, PREORDER_NOT_RECEIVING],
    ])('explains %s', (_case, patch, reason) => {
      expect(preorderNotAcceptingReason({ ...open, ...patch })).toBe(reason);
    });

    it('uses the exact Spanish messages of the contract', () => {
      expect(PREORDER_CLOSED).toBe('El local está cerrado en este momento');
      expect(PREORDER_NOT_RECEIVING).toBe('El local no está recibiendo pedidos en este momento');
    });
  });

  describe('onlineCheckoutStatusFor', () => {
    it('only a processed order is paid', () => {
      expect(onlineCheckoutStatusFor('processed', false)).toBe('paid');
      expect(onlineCheckoutStatusFor('processed', true)).toBe('paid');
    });

    it.each(['created', 'processing', 'action_required', 'unknown'] as const)('keeps %s pending until the checkout expires', (status) => {
      expect(onlineCheckoutStatusFor(status, false)).toBeNull();
      expect(onlineCheckoutStatusFor(status, true)).toBe('expired');
    });

    it('maps failed, expired, canceled and refunded', () => {
      expect(onlineCheckoutStatusFor('failed', false)).toBe('payment_failed');
      expect(onlineCheckoutStatusFor('expired', false)).toBe('expired');
      expect(onlineCheckoutStatusFor('canceled', false)).toBe('cancelled');
      // Mercado Pago also cancels expired online orders.
      expect(onlineCheckoutStatusFor('canceled', true)).toBe('expired');
      expect(onlineCheckoutStatusFor('refunded', false)).toBe('cancelled');
    });
  });

  describe('preorderTrackingStatus', () => {
    it('shows the checkout status until it is paid', () => {
      expect(preorderTrackingStatus('awaiting_payment', null)).toBe('awaiting_payment');
      expect(preorderTrackingStatus('payment_failed', null)).toBe('payment_failed');
      expect(preorderTrackingStatus('expired', null)).toBe('expired');
      expect(preorderTrackingStatus('cancelled', null)).toBe('cancelled');
    });

    it('follows the order once paid', () => {
      expect(preorderTrackingStatus('paid', 'pending')).toBe('received');
      expect(preorderTrackingStatus('paid', 'confirmed')).toBe('received');
      expect(preorderTrackingStatus('paid', 'preparing')).toBe('preparing');
      expect(preorderTrackingStatus('paid', 'ready')).toBe('ready');
      expect(preorderTrackingStatus('paid', 'delivered')).toBe('delivered');
      expect(preorderTrackingStatus('paid', 'cancelled')).toBe('cancelled');
      expect(preorderTrackingStatus('paid', 'refunded')).toBe('cancelled');
      expect(preorderTrackingStatus('paid', null)).toBe('received');
    });
  });

  it('estimates the longest preparation time of the items, 10 minutes by default', () => {
    expect(estimatedPreparationMinutes([{ preparationTimeMinutes: 4 }, { preparationTimeMinutes: 12 }, { preparationTimeMinutes: null }])).toBe(12);
    expect(estimatedPreparationMinutes([{ preparationTimeMinutes: null }])).toBe(10);
    expect(estimatedPreparationMinutes([])).toBe(10);
  });

  it('recognizes well-formed slugs (16+ URL-safe chars) and tracking tokens (43 chars)', () => {
    expect(isWellFormedPreorderSlug('a'.repeat(22))).toBe(true);
    expect(isWellFormedPreorderSlug('a'.repeat(15))).toBe(false);
    expect(isWellFormedPreorderSlug('abc/../def-ghijklmno')).toBe(false);
    expect(isWellFormedTrackingToken('A_-'.repeat(14) + 'x')).toBe(true);
    expect(isWellFormedTrackingToken('A'.repeat(42))).toBe(false);
  });

  it('references the checkout without personal data, within 64 chars of [A-Za-z0-9_-]', () => {
    expect(onlineCheckoutExternalReference('3f2a9c1e-7b4d-4e8a-9f10-1a2b3c4d5e6f')).toBe('UNNAPA3f2a9c1e7b4d4e8a9f101a2b3c4d5e6f');
  });
});
