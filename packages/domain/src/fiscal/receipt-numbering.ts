import type { FiscalReceiptType } from '../ports/fiscal.port';

/** Receipts that get a number of their own sequence per (business, point of sale, type). */
export type NumberedReceiptType = FiscalReceiptType | 'ticket';

const MAX_RECEIPT_NUMBER = 99_999_999;

/** e.g. 'B-0003-00000042'. */
export function formatReceiptNumber(type: NumberedReceiptType, pointOfSale: string, number: number): string {
  if (!Number.isInteger(number) || number < 1 || number > MAX_RECEIPT_NUMBER) throw new Error('Número de comprobante inválido');
  return `${type}-${pointOfSale.padStart(4, '0')}-${String(number).padStart(8, '0')}`;
}

/** Placeholder for a receipt that has no number yet (a draft waiting for ARCA); unique per receipt. */
export function draftReceiptNumber(receiptId: string): string {
  return `BORRADOR-${receiptId}`;
}
