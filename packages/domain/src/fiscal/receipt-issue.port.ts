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

/** A number sequence of the business, without the order. */
export type ReceiptSequenceScope = Omit<ReceiptIssueScope, 'orderId'>;

/**
 * Last number used for the locked (business, point of sale, type), and its issue lease (S18): the
 * receipt whose ARCA authorization is in flight. One lease per sequence means one ARCA call per
 * sequence at a time, so numbers are asked in order and approved without gaps or duplicates.
 */
export interface ReceiptSequencePort {
  lastNumber(): Promise<number>;
  advanceTo(number: number): Promise<void>;
  /** The receipt holding the lease, or null when it is free or expired (`until` <= now). */
  leaseHolder(now: Date): Promise<string | null>;
  claimLease(receiptId: string, until: Date): Promise<void>;
  /** Frees the lease only while `receiptId` holds it (an expired lease may have been taken over). */
  releaseLease(receiptId: string): Promise<void>;
}

export interface LockedReceiptIssue {
  receipts: ReceiptRepositoryPort;
  sequence: ReceiptSequencePort;
  /** True while `receiptId` holds an unexpired lease of any sequence of the business. */
  isIssuing(receiptId: string, now: Date): Promise<boolean>;
}

export interface ReceiptIssueUnitOfWorkPort {
  /**
   * Runs `work` in one short transaction while holding the order and its sequence locks, so
   * concurrent issues never reuse a number nor give one order two receipts. Writes made through the
   * given repositories commit together when `work` resolves, and roll back when it throws. ARCA is
   * never called inside: the work claims the sequence lease and ARCA is called after it (S18).
   */
  withIssueLock<T>(scope: ReceiptIssueScope, work: (locked: LockedReceiptIssue) => Promise<T>): Promise<T>;
  /**
   * Same transaction with only the sequence locked: records ARCA's answer and frees the lease
   * without touching the order lock, so payments and status changes never wait for ARCA.
   */
  withSequenceLock<T>(scope: ReceiptSequenceScope, work: (locked: LockedReceiptIssue) => Promise<T>): Promise<T>;
}
