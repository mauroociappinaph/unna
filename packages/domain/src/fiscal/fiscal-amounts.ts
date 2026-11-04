import type { FiscalIvaLine, FiscalReceiptType } from '../ports/fiscal.port';

/** An order line in cents: net price and the IVA charged on top of it. */
export interface FiscalAmountLine {
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
}

/** Receipt amounts in cents, as ARCA expects them. */
export interface FiscalAmounts {
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  ivaBreakdown: FiscalIvaLine[];
}

/**
 * Splits `amount` across `weights` proportionally, in whole cents that add up exactly
 * (largest remainder: leftover cents go to the largest fractional shares).
 */
function apportion(amount: number, weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total === 0) return weights.map(() => 0);
  const exact = weights.map((w) => (amount * w) / total);
  const shares = exact.map(Math.floor);
  let leftover = amount - shares.reduce((sum, s) => sum + s, 0);
  const byFraction = exact.map((e, i) => ({ i, fraction: e - Math.floor(e) })).sort((a, b) => b.fraction - a.fraction);
  for (const { i } of byFraction) {
    if (leftover === 0) break;
    shares[i] += 1;
    leftover -= 1;
  }
  return shares;
}

/**
 * Amounts of a fiscal receipt from the order lines (prices are net, IVA on top) and the order
 * discount, which reduces the final total. A/B discriminate IVA per rate: the discount is spread
 * over the rates by their gross amount and, within a rate, over base and IVA, so the lines add up
 * to the order total to the cent. C receipts carry the whole total as net, without IVA.
 */
export function computeFiscalAmounts(type: FiscalReceiptType, lines: FiscalAmountLine[], discount: number): FiscalAmounts {
  const groups: FiscalIvaLine[] = [];
  for (const line of lines) {
    const group = groups.find((g) => g.rate === line.taxRate);
    if (group) {
      group.base += line.totalPrice;
      group.amount += line.taxAmount;
    } else {
      groups.push({ rate: line.taxRate, base: line.totalPrice, amount: line.taxAmount });
    }
  }
  groups.sort((a, b) => b.rate - a.rate);

  const gross = groups.map((g) => g.base + g.amount);
  const totalGross = gross.reduce((sum, g) => sum + g, 0);
  if (discount > totalGross) throw new Error('El descuento no puede ser mayor al total del pedido');
  const totalAmount = totalGross - discount;

  if (type === 'C') return { netAmount: totalAmount, ivaAmount: 0, totalAmount, ivaBreakdown: [] };

  const discounts = apportion(discount, gross);
  const ivaBreakdown = groups.map((g, i) => {
    const discountedGross = gross[i] - discounts[i];
    const baseDiscount = gross[i] === 0 ? 0 : Math.round((discounts[i] * g.base) / gross[i]);
    const base = g.base - baseDiscount;
    return { rate: g.rate, base, amount: discountedGross - base };
  });
  const netAmount = ivaBreakdown.reduce((sum, l) => sum + l.base, 0);
  return { netAmount, ivaAmount: totalAmount - netAmount, totalAmount, ivaBreakdown };
}
