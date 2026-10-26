import { Receipt, type ReceiptProps } from './receipt';

/** A receipt as the list shows it (S17): every field but the items, with how many there are. */
export type ReceiptSummary = Omit<ReceiptProps, 'items'> & Pick<Receipt, 'netAmount' | 'ivaAmount'> & { itemCount: number };

// The net and IVA amounts come from the IVA lines, not from the items, so they stay exact.
export function summarizeReceipt(props: Omit<ReceiptProps, 'items'>, itemCount: number): ReceiptSummary {
  const { netAmount, ivaAmount } = Receipt.reconstitute({ ...props, items: [] });
  return { ...props, netAmount, ivaAmount, itemCount };
}
