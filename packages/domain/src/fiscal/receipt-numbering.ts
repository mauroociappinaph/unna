import type { FiscalReceiptType } from '../ports/fiscal.port';

/** Receipts that get a number of their own sequence per (business, point of sale, type). */
export type NumberedReceiptType = FiscalReceiptType | 'ticket';

const MAX_RECEIPT_NUMBER = 99_999_999;

/**
 * How long one fiscal issue may hold the lease of its sequence while ARCA authorizes it (S18). ARCA
 * answers in up to three calls of 15 s (login, last number, authorization); a lease older than this
 * belongs to a crashed request and is taken over.
 */
export const RECEIPT_ISSUE_LEASE_MS = 2 * 60 * 1000;

/** e.g. 'B-0003-00000042'. */
export function formatReceiptNumber(type: NumberedReceiptType, pointOfSale: string, number: number): string {
  if (!Number.isInteger(number) || number < 1 || number > MAX_RECEIPT_NUMBER) throw new Error('Número de comprobante inválido');
  return `${type}-${pointOfSale.padStart(4, '0')}-${String(number).padStart(8, '0')}`;
}

/** Placeholder for a receipt that has no number yet (a draft waiting for ARCA); unique per receipt. */
export function draftReceiptNumber(receiptId: string): string {
  return `BORRADOR-${receiptId}`;
}
