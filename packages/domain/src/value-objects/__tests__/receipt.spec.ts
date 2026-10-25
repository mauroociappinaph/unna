import { Receipt, ReceiptItem } from '../receipt';
import { Money } from '../money';

const receiptItem = () => {
  const unitPrice = Money.fromCents(1000);
  const totalPrice = unitPrice.multiply(2);
  return {
    productId: 'prod-1',
    productName: 'Milanesa',
    quantity: 2,
    unitPrice,
    totalPrice,
    taxRate: 21,
    taxAmount: totalPrice.percentage(21),
    modifiers: [],
  };
};

const newReceipt = (overrides: Record<string, unknown> = {}) =>
  Receipt.create({
    businessId: 'biz-1',
    sucursalId: 'suc-1',
    type: 'B',
    pointOfSale: '0001',
    receiptType: 'B',
    paymentMethod: 'cash',
    items: [receiptItem()],
    ...overrides,
  } as any);

describe('Receipt', () => {
  describe('create', () => {
    it('builds ReceiptItem instances linked to the receipt', () => {
      const receipt = newReceipt();
      expect(receipt.items[0]).toBeInstanceOf(ReceiptItem);
      expect(receipt.items[0].receiptId).toBe(receipt.id);
    });

    it('computes totals and starts as draft', () => {
      const receipt = newReceipt();
      expect(receipt.subtotal.toCents()).toBe(2000);
      expect(receipt.taxAmount.toCents()).toBe(420);
      expect(receipt.totalAmount.toCents()).toBe(2420);
      expect(receipt.status).toBe('draft');
      expect(receipt.receiptNumber.startsWith('B-0001-')).toBe(true);
    });

    it('carries the order discount into the total', () => {
      const receipt = newReceipt({ discountAmount: Money.fromCents(400) });
      expect(receipt.discountAmount.toCents()).toBe(400);
      expect(receipt.totalAmount.toCents()).toBe(2020);
    });

    it('rejects a point of sale that is not 4 digits', () => {
      expect(() => newReceipt({ pointOfSale: '1' })).toThrow('Punto de venta debe ser 4 dígitos');
    });

    it('rejects a receipt without items', () => {
      expect(() => newReceipt({ items: [] })).toThrow('El comprobante debe tener al menos un item');
    });
  });

  describe('lifecycle', () => {
    it('issues a draft and records the CAE', () => {
      const issued = newReceipt().issue('12345678901234', new Date('2026-11-04'));
      expect(issued.status).toBe('issued');
      expect(issued.cae).toBe('12345678901234');
      expect(issued.issuedAt).toBeInstanceOf(Date);
    });

    it('rejects issuing twice', () => {
      const issued = newReceipt().issue();
      expect(() => issued.issue()).toThrow('Solo borradores pueden emitirse');
    });

    it('only cancels issued receipts', () => {
      expect(() => newReceipt().cancel('error')).toThrow('Solo comprobantes emitidos pueden cancelarse');
      const cancelled = newReceipt().issue().cancel('Error de carga');
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledReason).toBe('Error de carga');
    });
  });
});
