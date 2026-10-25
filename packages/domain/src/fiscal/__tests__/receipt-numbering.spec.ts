import { formatReceiptNumber } from '../receipt-numbering';

describe('formatReceiptNumber', () => {
  it('formats <type>-<point of sale 4>-<number 8>', () => {
    expect(formatReceiptNumber('B', '3', 42)).toBe('B-0003-00000042');
    expect(formatReceiptNumber('A', '0001', 1)).toBe('A-0001-00000001');
    expect(formatReceiptNumber('ticket', '0002', 12345678)).toBe('ticket-0002-12345678');
  });

  it('rejects numbers that are not positive integers of up to 8 digits', () => {
    for (const n of [0, -1, 1.5, 100000000]) {
      expect(() => formatReceiptNumber('B', '0001', n)).toThrow('Número de comprobante inválido');
    }
  });
});
