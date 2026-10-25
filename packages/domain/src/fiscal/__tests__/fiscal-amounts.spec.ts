import { computeFiscalAmounts } from '../fiscal-amounts';

/** An order line in cents, taxed like OrderItem: tax = round(net * rate / 100). */
const line = (net: number, taxRate: number) => ({ totalPrice: net, taxRate, taxAmount: Math.round((net * taxRate) / 100) });

describe('computeFiscalAmounts', () => {
  it('groups A/B amounts by rate with the order item bases and taxes when there is no discount', () => {
    const amounts = computeFiscalAmounts('B', [line(1000, 21), line(500, 21), line(1000, 10.5)], 0);
    expect(amounts).toEqual({
      netAmount: 2500,
      ivaAmount: 420,
      totalAmount: 2920,
      ivaBreakdown: [
        { rate: 21, base: 1500, amount: 315 },
        { rate: 10.5, base: 1000, amount: 105 },
      ],
    });
  });

  it('spreads the order discount across 21 and 10.5 so net + IVA equals the order total to the cent', () => {
    // Gross 1210 + 1105 = 2315; discount 100 -> 52 on 21% and 48 on 10.5% (largest remainder).
    const amounts = computeFiscalAmounts('A', [line(1000, 21), line(1000, 10.5)], 100);
    expect(amounts).toEqual({
      netAmount: 1914,
      ivaAmount: 301,
      totalAmount: 2215,
      ivaBreakdown: [
        { rate: 21, base: 957, amount: 201 },
        { rate: 10.5, base: 957, amount: 100 },
      ],
    });
  });

  it('keeps cents exact for awkward discounts and rates, including 27 and 0', () => {
    const lines = [line(333, 21), line(777, 10.5), line(1001, 27), line(250, 0)];
    const gross = lines.reduce((sum, l) => sum + l.totalPrice + l.taxAmount, 0);
    for (const discount of [1, 7, 99, 333, 1000]) {
      const amounts = computeFiscalAmounts('B', lines, discount);
      const lineSum = amounts.ivaBreakdown.reduce((sum, l) => sum + l.base + l.amount, 0);
      expect(amounts.totalAmount).toBe(gross - discount);
      expect(amounts.netAmount + amounts.ivaAmount).toBe(amounts.totalAmount);
      expect(lineSum).toBe(amounts.totalAmount);
      expect(amounts.ivaBreakdown.find((l) => l.rate === 0)?.amount).toBe(0);
      for (const l of amounts.ivaBreakdown) {
        expect(Number.isInteger(l.base) && Number.isInteger(l.amount)).toBe(true);
        expect(Math.abs(l.amount - (l.base * l.rate) / 100)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('puts the whole order total as net on a C receipt, with no IVA and no breakdown', () => {
    expect(computeFiscalAmounts('C', [line(1000, 21), line(1000, 10.5)], 100)).toEqual({
      netAmount: 2215,
      ivaAmount: 0,
      totalAmount: 2215,
      ivaBreakdown: [],
    });
  });

  it('rejects a discount larger than the order', () => {
    expect(() => computeFiscalAmounts('B', [line(100, 21)], 200)).toThrow('El descuento no puede ser mayor al total del pedido');
  });
});
