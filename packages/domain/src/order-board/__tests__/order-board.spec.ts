import {
  argentinaDayWindow,
  bucketBarQueue,
  isWellFormedDisplayToken,
  publicBoardColumn,
  publicCustomerName,
  shortOrderNumber,
} from '..';

describe('order board rules (S13)', () => {
  describe('argentinaDayWindow', () => {
    it('starts at 00:00 Argentina (03:00 UTC) and lasts 24 hours', () => {
      const window = argentinaDayWindow(new Date('2026-10-25T15:00:00Z'));
      expect(window.from.toISOString()).toBe('2026-10-25T03:00:00.000Z');
      expect(window.to.toISOString()).toBe('2026-10-26T03:00:00.000Z');
    });

    it('still belongs to the previous Argentine day before 03:00 UTC', () => {
      const window = argentinaDayWindow(new Date('2026-10-26T02:59:59Z'));
      expect(window.from.toISOString()).toBe('2026-10-25T03:00:00.000Z');
      expect(window.to.toISOString()).toBe('2026-10-26T03:00:00.000Z');
    });

    it('moves to the next day exactly at 03:00 UTC', () => {
      expect(argentinaDayWindow(new Date('2026-10-26T03:00:00Z')).from.toISOString()).toBe('2026-10-26T03:00:00.000Z');
    });
  });

  describe('shortOrderNumber', () => {
    it.each([
      ['ORD-20261025-0042', '042'],
      ['T-7', 'T-7'],
      ['12', '12'],
    ])('%s → %s', (orderNumber, expected) => {
      expect(shortOrderNumber(orderNumber)).toBe(expected);
    });
  });

  describe('publicCustomerName', () => {
    it.each<[string | null | undefined, string | null]>([
      ['María José Pérez', 'María'],
      ['  Juan  ', 'Juan'],
      ['Maximilianoooo Rossi', 'Maximilianoo'],
      ['', null],
      ['   ', null],
      [null, null],
      [undefined, null],
    ])('%p → %p', (name, expected) => {
      expect(publicCustomerName(name)).toBe(expected);
    });
  });

  describe('bucketBarQueue', () => {
    const order = (id: string, status: string, minute: number) => ({
      id,
      status: status as never,
      createdAt: new Date(Date.UTC(2026, 9, 25, 12, minute)),
    });

    it('puts pending/confirmed in new, preparing in preparing and ready in ready, oldest first', () => {
      const buckets = bucketBarQueue([
        order('c', 'confirmed', 5),
        order('r', 'ready', 1),
        order('p', 'pending', 2),
        order('prep', 'preparing', 3),
        order('d', 'delivered', 0),
        order('x', 'cancelled', 0),
        order('rf', 'refunded', 0),
      ]);
      expect(buckets.new.map((o) => o.id)).toEqual(['p', 'c']);
      expect(buckets.preparing.map((o) => o.id)).toEqual(['prep']);
      expect(buckets.ready.map((o) => o.id)).toEqual(['r']);
    });
  });

  describe('publicBoardColumn', () => {
    it.each([
      ['pending', 'preparing'],
      ['confirmed', 'preparing'],
      ['preparing', 'preparing'],
      ['ready', 'ready'],
      ['delivered', null],
      ['cancelled', null],
      ['refunded', null],
    ])('%s → %p', (status, expected) => {
      expect(publicBoardColumn(status as never)).toBe(expected);
    });
  });

  describe('isWellFormedDisplayToken', () => {
    const valid = 'A'.repeat(40) + '-_9';

    it('accepts 43 base64url characters (32 random bytes)', () => {
      expect(valid).toHaveLength(43);
      expect(isWellFormedDisplayToken(valid)).toBe(true);
    });

    it.each([
      ['too short', 'A'.repeat(42)],
      ['too long', 'A'.repeat(44)],
      ['padding', 'A'.repeat(42) + '='],
      ['standard base64 characters', 'A'.repeat(41) + '+/'],
      ['path characters', 'A'.repeat(40) + '../'],
      ['empty', ''],
    ])('rejects %s', (_name, token) => {
      expect(isWellFormedDisplayToken(token)).toBe(false);
    });
  });
});
