import type { ReceiptRepositoryPort } from '../ports/repository.port';
import type { NumberedReceiptType } from './receipt-numbering';

/** What a receipt issue locks: the order (one active receipt per order) and its number sequence. */
export interface ReceiptIssueScope {
  businessId: string;
  orderId: string;
  /** 4 digits. */
  pointOfSale: string;
  receiptType: NumberedReceiptType;
}

/** Last number used for the locked (business, point of sale, type). */
export interface ReceiptSequencePort {
  lastNumber(): Promise<number>;
  advanceTo(number: number): Promise<void>;
}

export interface LockedReceiptIssue {
  receipts: ReceiptRepositoryPort;
  sequence: ReceiptSequencePort;
}

export interface ReceiptIssueUnitOfWorkPort {
  /**
   * Runs `work` in one transaction while holding the order and its sequence locks, so concurrent
   * issues never reuse a number nor give one order two receipts. Writes made through the given
   * repositories commit together when `work` resolves, and roll back when it throws.
   */
  withIssueLock<T>(scope: ReceiptIssueScope, work: (locked: LockedReceiptIssue) => Promise<T>): Promise<T>;
}
