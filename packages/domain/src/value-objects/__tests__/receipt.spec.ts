import { Receipt, ReceiptItem } from '../receipt';
import { Money } from '../money';

const receiptItem = (net = 1000, quantity = 2, taxRate = 21) => {
  const unitPrice = Money.fromCents(net);
  const totalPrice = unitPrice.multiply(quantity);
  return {
    productId: 'prod-1',
    productName: 'Milanesa',
    quantity,
    unitPrice,
    totalPrice,
    taxRate,
    taxAmount: totalPrice.percentage(taxRate),
    modifiers: [],
  };
};

const newReceipt = (overrides: Partial<Parameters<typeof Receipt.create>[0]> = {}) =>
  Receipt.create({
    businessId: 'biz-1',
    sucursalId: 'suc-1',
    type: 'B',
    pointOfSale: '0001',
    receiptType: 'B',
    paymentMethod: 'cash',
    docType: 99,
    docNumber: '0',
    items: [receiptItem()],
    ...overrides,
  });

const newTicket = () => newReceipt({ type: 'ticket', receiptType: 'ticket', docType: undefined, docNumber: undefined });

const approval = { number: 42, cae: '71234567890123', caeExpiration: new Date('2026-11-04'), qrCode: 'https://www.afip.gob.ar/fe/qr/?p=x' };

describe('Receipt', () => {
  describe('create', () => {
    it('builds ReceiptItem instances linked to the receipt', () => {
      const receipt = newReceipt();
      expect(receipt.items[0]).toBeInstanceOf(ReceiptItem);
      expect(receipt.items[0].receiptId).toBe(receipt.id);
    });

    it('computes totals and starts as a draft without a number', () => {
      const receipt = newReceipt();
      expect(receipt.subtotal.toCents()).toBe(2000);
      expect(receipt.taxAmount.toCents()).toBe(420);
      expect(receipt.totalAmount.toCents()).toBe(2420);
      expect(receipt.status).toBe('draft');
      expect(receipt.invoiceNumber).toBeUndefined();
      expect(receipt.receiptNumber).toBe(`BORRADOR-${receipt.id}`);
    });

    it('carries the order discount into the total', () => {
      const receipt = newReceipt({ discountAmount: Money.fromCents(400) });
      expect(receipt.discountAmount.toCents()).toBe(400);
      expect(receipt.totalAmount.toCents()).toBe(2020);
    });

    it('discriminates IVA by rate on A/B with the discount spread so net + IVA = total', () => {
      const receipt = newReceipt({
        items: [receiptItem(1000, 1, 21), receiptItem(1000, 1, 10.5)],
        discountAmount: Money.fromCents(100),
      });
      expect(receipt.ivaBreakdown).toEqual([
        { rate: 21, base: 957, amount: 201 },
        { rate: 10.5, base: 957, amount: 100 },
      ]);
      expect(receipt.netAmount.toCents()).toBe(1914);
      expect(receipt.ivaAmount.toCents()).toBe(301);
      expect(receipt.totalAmount.toCents()).toBe(2215);
    });

    it('reports a C receipt with the whole total as net and no IVA', () => {
      const receipt = newReceipt({ type: 'C', receiptType: 'C' });
      expect(receipt.ivaBreakdown).toEqual([]);
      expect(receipt.netAmount.toCents()).toBe(2420);
      expect(receipt.ivaAmount.toCents()).toBe(0);
    });

    it('keeps the customer document', () => {
      const receipt = newReceipt({ type: 'A', receiptType: 'A', docType: 80, docNumber: '20123456786', customerTaxId: '20123456786' });
      expect(receipt.docType).toBe(80);
      expect(receipt.docNumber).toBe('20123456786');
    });

    it('rejects a factura A without a CUIT document', () => {
      expect(() => newReceipt({ type: 'A', receiptType: 'A', docType: 99, docNumber: '0' })).toThrow('La factura A requiere el CUIT del cliente');
    });

    it('rejects a fiscal receipt without a customer document', () => {
      expect(() => newReceipt({ docType: undefined, docNumber: undefined })).toThrow('El comprobante fiscal requiere el documento del cliente');
    });

    it('rejects a point of sale that is not 4 digits', () => {
      expect(() => newReceipt({ pointOfSale: '1' })).toThrow('Punto de venta debe ser 4 dígitos');
    });

    it('rejects a receipt without items', () => {
      expect(() => newReceipt({ items: [] })).toThrow('El comprobante debe tener al menos un item');
    });

    it('rebuilds a draft in place, keeping its id and creation date', () => {
      const draft = newReceipt().failAuthorization('10016 número inválido');
      const redrafted = newReceipt({ type: 'A', receiptType: 'A', docType: 80, docNumber: '20123456786', replaces: draft });
      expect(redrafted.id).toBe(draft.id);
      expect(redrafted.createdAt).toBe(draft.createdAt);
      expect(redrafted.type).toBe('A');
      expect(redrafted.items[0].receiptId).toBe(draft.id);
      expect(redrafted.authorizationError).toBeUndefined();
    });

    it('only rebuilds drafts', () => {
      const issued = newTicket().issueTicket(1);
      expect(() => newReceipt({ replaces: issued })).toThrow('Solo un borrador puede rehacerse');
    });
  });

  describe('lifecycle', () => {
    it('issues a ticket with its sequential number', () => {
      const issued = newTicket().issueTicket(7);
      expect(issued.status).toBe('issued');
      expect(issued.invoiceNumber).toBe(7);
      expect(issued.receiptNumber).toBe('ticket-0001-00000007');
      expect(issued.issuedAt).toBeInstanceOf(Date);
    });

    it('does not issue a fiscal receipt as a ticket', () => {
      expect(() => newReceipt().issueTicket(1)).toThrow('Solo un ticket se emite sin autorización fiscal');
    });

    it('marks a fiscal draft authorized with CAE, expiration, number and QR', () => {
      const authorized = newReceipt().failAuthorization('ARCA no respondió').authorize(approval);
      expect(authorized.status).toBe('issued');
      expect(authorized.cae).toBe('71234567890123');
      expect(authorized.caeExpiration).toEqual(new Date('2026-11-04'));
      expect(authorized.invoiceNumber).toBe(42);
      expect(authorized.receiptNumber).toBe('B-0001-00000042');
      expect(authorized.qrCode).toBe(approval.qrCode);
      expect(authorized.authorizationError).toBeUndefined();
      expect(authorized.issuedAt).toBeInstanceOf(Date);
    });

    it('does not authorize a ticket', () => {
      expect(() => newTicket().authorize(approval)).toThrow('Solo un comprobante fiscal se autoriza en ARCA');
    });

    it('keeps a draft with the authorization error', () => {
      const draft = newReceipt().failAuthorization('10016: número inválido');
      expect(draft.status).toBe('draft');
      expect(draft.authorizationError).toBe('10016: número inválido');
      expect(draft.invoiceNumber).toBeUndefined();
    });

    it('rejects authorizing or failing twice', () => {
      const issued = newReceipt().authorize(approval);
      expect(() => issued.authorize(approval)).toThrow('Solo borradores pueden emitirse');
      expect(() => issued.failAuthorization('x')).toThrow('Solo borradores pueden emitirse');
      expect(() => newTicket().issueTicket(1).issueTicket(2)).toThrow('Solo borradores pueden emitirse');
    });

    it('only cancels issued receipts', () => {
      expect(() => newReceipt().cancel('error')).toThrow('Solo comprobantes emitidos pueden cancelarse');
      const cancelled = newTicket().issueTicket(1).cancel('Error de carga');
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledReason).toBe('Error de carga');
    });
  });
});
