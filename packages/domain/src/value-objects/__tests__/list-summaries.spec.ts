import { CLOSED_ORDER_STATUSES, isOrderClosed, type OrderStatus } from '../order';
import { Receipt } from '../receipt';
import { Money } from '../money';
import { summarizeReceipt } from '../receipt-summary';

describe('closed orders (S17)', () => {
  it('are the delivered, cancelled and refunded ones, as the POS shows them', () => {
    expect(CLOSED_ORDER_STATUSES).toEqual(['delivered', 'cancelled', 'refunded']);
  });

  it.each<[OrderStatus, boolean]>([
    ['pending', false],
    ['confirmed', false],
    ['preparing', false],
    ['ready', false],
    ['delivered', true],
    ['cancelled', true],
    ['refunded', true],
  ])('%s is closed: %p', (status, closed) => {
    expect(isOrderClosed(status)).toBe(closed);
  });
});

describe('summarizeReceipt (S17)', () => {
  it('keeps every field of the receipt but its items, with the item count and the computed amounts', () => {
    const unitPrice = Money.fromCents(1000);
    const line = { productId: 'p1', productName: 'Café', quantity: 1, unitPrice, totalPrice: unitPrice, taxRate: 21, taxAmount: unitPrice.percentage(21), modifiers: [] };
    const receipt = Receipt.create({
      businessId: 'biz-1', sucursalId: 'suc-1', type: 'B', pointOfSale: '0001', receiptType: 'B', paymentMethod: 'cash',
      docType: 99, docNumber: '0', items: [line, { ...line, productId: 'p2' }],
    });
    const { items, ...fields } = JSON.parse(JSON.stringify(receipt));
    const { items: _unused, ...props } = receipt;

    const summary = JSON.parse(JSON.stringify(summarizeReceipt(props, items.length)));

    expect(summary).toEqual({ ...fields, itemCount: 2 });
    expect(summary).not.toHaveProperty('items');
    expect(_unused).toHaveLength(2);
  });
});
