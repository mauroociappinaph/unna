import { Logger } from '@nestjs/common';
import {
  buildArcaQrUrl,
  FiscalAuthorizationRequest,
  FiscalAuthorizationResult,
  FiscalAuthorizerPort,
  FiscalReceiptType,
  LockedReceiptIssue,
  Receipt,
  RECEIPT_ISSUE_LEASE_MS,
  ReceiptIssueScope,
  ReceiptIssueUnitOfWorkPort,
  receiverVatCondition,
} from '@unna/domain';

/** ARCA did not answer: the receipt stays a retriable draft. Mapped to 503, not to a client error. */
export class FiscalAuthorizerUnavailableError extends Error {
  constructor() {
    super('ARCA no está disponible en este momento; el comprobante quedó en borrador y podés reintentarlo');
    this.name = 'FiscalAuthorizerUnavailableError';
  }
}

export interface IssueResult {
  ok: boolean;
  value?: Receipt;
  error?: Error;
}

/** The business data a fiscal receipt needs from ARCA's point of view. */
export interface Issuer {
  cuit: string;
  pointOfSale: string;
}

const ALREADY_ISSUED = 'El pedido ya tiene un comprobante';
const SEQUENCE_BUSY = 'Se está emitiendo otro comprobante en este punto de venta. Probá de nuevo en unos segundos';
const APPROVED_NOT_SAVED = 'ARCA aprobó el comprobante pero no se pudo guardar. No lo vuelvas a emitir; contactá a soporte.';

/** Saving an approved receipt is retried this many times, waiting CONFIRM_RETRY_MS × attempt in between. */
const CONFIRM_ATTEMPTS = 3;
const CONFIRM_RETRY_MS = 200;

/** A concurrent issue waits this long for the issue holding its sequence or its order. */
const LEASE_WAIT_MS = 30_000;
const LEASE_POLL_MS = 100;

type Reservation =
  | { kind: 'done'; result: IssueResult }
  | { kind: 'busy' }
  | { kind: 'leased'; draft: Receipt; lastNumber: number };

const ok = (value: Receipt): IssueResult => ({ ok: true, value });
const fail = (message: string): IssueResult => ({ ok: false, error: new Error(message) });

/**
 * Issues the receipt of an order without calling ARCA while holding locks (S18):
 *
 * 1. Reserve, in a short transaction with the order and sequence rows locked: one issued receipt
 *    per order, the draft saved, and the lease of the (business, point of sale, type) sequence
 *    claimed for it until RECEIPT_ISSUE_LEASE_MS. Tickets are numbered and issued right there.
 * 2. ARCA (last authorized number, then the authorization) without any transaction open.
 * 3. Confirm, in a short transaction with only the sequence row locked: the approved number
 *    advances the sequence and the receipt is issued; a rejection or a failure keeps the draft
 *    retriable without consuming the number. The lease is freed in every case, also when anything
 *    throws on the way, except when ARCA approved and saving it keeps failing: then the lease stays
 *    held until it expires, so no other number is asked for while the approved one is unconfirmed.
 *
 * ARCA only approves the next number of a sequence, so the lease lets one authorization per
 * sequence run at a time: numbers stay consecutive, without gaps nor duplicates. Concurrent issues
 * of the sequence, or of the same order, wait for the lease instead of a row lock; an expired
 * lease belongs to a crashed request and is taken over. Payments and status changes of the order
 * never wait for ARCA, since its row is locked only during step 1.
 */
export class ReceiptIssueLease {
  private readonly logger = new Logger(ReceiptIssueLease.name);

  constructor(
    private readonly unitOfWork: ReceiptIssueUnitOfWorkPort,
    private readonly authorizer: FiscalAuthorizerPort,
  ) {}

  /** `buildDraft` rebuilds the order's previous draft (same id) or creates a new one. */
  async issue(scope: ReceiptIssueScope, issuer: Issuer, buildDraft: (previous?: Receipt) => Receipt): Promise<IssueResult> {
    const deadline = Date.now() + LEASE_WAIT_MS;
    for (;;) {
      const reservation = await this.unitOfWork.withIssueLock(scope, (locked) => this.reserve(locked, scope, buildDraft));
      if (reservation.kind === 'done') return reservation.result;
      if (reservation.kind === 'leased') return this.authorizeUnderLease(scope, reservation.draft, reservation.lastNumber, issuer);
      if (Date.now() + LEASE_POLL_MS > deadline) return fail(SEQUENCE_BUSY);
      await new Promise((resolve) => setTimeout(resolve, LEASE_POLL_MS));
    }
  }

  private async reserve(locked: LockedReceiptIssue, scope: ReceiptIssueScope, buildDraft: (previous?: Receipt) => Receipt): Promise<Reservation> {
    const now = new Date();
    const existing = await locked.receipts.findByOrderId(scope.orderId);
    if (existing.some((r) => r.status === 'issued')) return { kind: 'done', result: fail(ALREADY_ISSUED) };
    const previous = existing.find((r) => r.status === 'draft');
    // The order's draft is being authorized (maybe as another type): wait for its outcome.
    if (previous && (await locked.isIssuing(previous.id, now))) return { kind: 'busy' };

    const draft = buildDraft(previous);
    if (draft.type === 'ticket') {
      const number = (await locked.sequence.lastNumber()) + 1;
      await locked.sequence.advanceTo(number);
      const ticket = draft.issueTicket(number);
      await locked.receipts.save(ticket);
      return { kind: 'done', result: ok(ticket) };
    }

    if (await locked.sequence.leaseHolder(now)) return { kind: 'busy' };
    await locked.sequence.claimLease(draft.id, new Date(now.getTime() + RECEIPT_ISSUE_LEASE_MS));
    await locked.receipts.save(draft);
    return { kind: 'leased', draft, lastNumber: await locked.sequence.lastNumber() };
  }

  /** Every outcome of `authorize` frees the lease itself; a throw on the way frees it here (best effort). */
  private async authorizeUnderLease(scope: ReceiptIssueScope, draft: Receipt, lastNumber: number, issuer: Issuer): Promise<IssueResult> {
    try {
      return await this.authorize(scope, draft, lastNumber, issuer);
    } catch (error) {
      const { businessId, pointOfSale, receiptType } = scope;
      await this.unitOfWork
        .withSequenceLock({ businessId, pointOfSale, receiptType }, ({ sequence }) => sequence.releaseLease(draft.id))
        .catch(() => undefined);
      throw error;
    }
  }

  /** Step 2, without locks. `lastNumber` stays valid: only the lease holder advances a fiscal sequence. */
  private async authorize(scope: ReceiptIssueScope, draft: Receipt, lastNumber: number, issuer: Issuer): Promise<IssueResult> {
    const type = scope.receiptType as FiscalReceiptType;
    const pointOfSale = Number(issuer.pointOfSale);
    let lastAuthorized: number;
    try {
      lastAuthorized = await this.authorizer.lastAuthorizedNumber(issuer.cuit, pointOfSale, type);
    } catch (error) {
      return this.keepRetriableDraft(scope, draft, error);
    }

    const request: FiscalAuthorizationRequest = {
      issuerCuit: issuer.cuit,
      pointOfSale,
      receiptType: type,
      number: Math.max(lastNumber, lastAuthorized) + 1,
      issueDate: new Date(),
      concept: 1,
      docType: draft.docType!,
      docNumber: draft.docNumber!,
      receiverVatCondition: receiverVatCondition(type, draft.customerCondition),
      netAmount: draft.netAmount.toCents(),
      exemptAmount: 0,
      ivaAmount: draft.ivaAmount.toCents(),
      totalAmount: draft.totalAmount.toCents(),
      ivaBreakdown: draft.ivaBreakdown,
      currency: 'PES',
    };
    const requested = draft.setCaeRequest(JSON.stringify(request));

    let result: FiscalAuthorizationResult;
    try {
      result = await this.authorizer.authorize(request);
    } catch (error) {
      return this.keepRetriableDraft(scope, requested, error);
    }

    if (!result.approved) {
      const message = `ARCA rechazó el comprobante: ${result.errors.map((e) => `${e.code} - ${e.message}`).join('; ')}`;
      await this.confirm(scope, requested.failAuthorization(message));
      return fail(message);
    }

    const issued = requested.authorize({
      number: result.number,
      cae: result.cae,
      caeExpiration: result.caeExpiration,
      caeResponse: result.raw,
      qrCode: buildArcaQrUrl({
        issueDate: request.issueDate,
        issuerCuit: issuer.cuit,
        pointOfSale,
        receiptType: type,
        number: result.number,
        totalAmount: request.totalAmount,
        docType: request.docType,
        docNumber: request.docNumber,
        cae: result.cae,
      }),
    });
    return (await this.confirmApproved(scope, issued, result.number)) ? ok(issued) : fail(APPROVED_NOT_SAVED);
  }

  /** ARCA already used the number: retry saving it, and keep the lease if it still fails. */
  private async confirmApproved(scope: ReceiptIssueScope, issued: Receipt, number: number): Promise<boolean> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.confirm(scope, issued, number);
        return true;
      } catch (error) {
        if (attempt >= CONFIRM_ATTEMPTS) {
          this.logger.error(`ARCA aprobó el comprobante ${issued.id} (número ${number}, CAE ${issued.cae}) pero no se pudo guardar: ${(error as Error).message}`);
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, CONFIRM_RETRY_MS * attempt));
      }
    }
  }

  /** ARCA did not answer (timeout, outage): keep the draft without a number so the cashier can retry. */
  private async keepRetriableDraft(scope: ReceiptIssueScope, draft: Receipt, error: unknown): Promise<IssueResult> {
    await this.confirm(scope, draft.failAuthorization(`ARCA no respondió: ${(error as Error).message}`));
    return { ok: false, error: new FiscalAuthorizerUnavailableError() };
  }

  /**
   * Step 3: stores the outcome and frees the lease. An approval is recorded even if the lease
   * expired meanwhile, since ARCA already authorized the number; the sequence only moves forward.
   */
  private async confirm(scope: ReceiptIssueScope, receipt: Receipt, approvedNumber?: number): Promise<void> {
    const { businessId, pointOfSale, receiptType } = scope;
    await this.unitOfWork.withSequenceLock({ businessId, pointOfSale, receiptType }, async ({ receipts, sequence }) => {
      if (approvedNumber !== undefined && approvedNumber > (await sequence.lastNumber())) await sequence.advanceTo(approvedNumber);
      await receipts.save(receipt);
      await sequence.releaseLease(receipt.id);
    });
  }
}
