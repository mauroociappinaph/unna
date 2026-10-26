import {
  FiscalAuthorizationRequest,
  FiscalAuthorizationResult,
  FiscalAuthorizerPort,
  IVACondition,
  LockedReceiptIssue,
  Money,
  Order,
  Receipt,
  ReceiptIssueScope,
  ReceiptIssueUnitOfWorkPort,
  ReceiptSequenceScope,
  summarizeReceipt,
} from '@unna/domain';
import { fake } from './test-doubles';
import { InvoicingUseCase } from '../invoicing.use-case';

const m = (cents: number) => Money.fromCents(cents);
export const ISSUER_CUIT = '30712345671';
export const CUSTOMER_CUIT = '20123456786';

type NewOrderLine = Parameters<Order['addItem']>[0];
export const line = (net: number, taxRate: number): NewOrderLine => ({
  productId: `p-${taxRate}`,
  productName: `Producto ${taxRate}`,
  quantity: 1,
  unitPrice: m(net),
  totalPrice: m(net),
  taxRate,
  taxAmount: m(net).percentage(taxRate),
  modifiers: [],
});

export const paidOrder = (lines: NewOrderLine[] = [line(1000, 21)], discount = 0) => {
  let order = Order.create({ businessId: 'biz-A', sucursalId: 'suc-1', sucursalName: 'Central', type: 'takeaway', items: lines });
  if (discount) order = order.applyDiscount(m(discount));
  return order.markPaymentCompleted('cash');
};

/**
 * ARCA double: remembers the last number per (issuer, point of sale, type) and answers after a tick.
 * `onCall` runs at the start of every call (to observe locks); `inFlight`/`maxInFlight` count the
 * calls running at the same time.
 */
export const fakeArca = () => {
  const last = new Map<string, number>();
  const requests: FiscalAuthorizationRequest[] = [];
  const behavior: { next: 'approve' | 'reject' | 'throw' | 'throw-on-last' } = { next: 'approve' };
  const calls = { inFlight: 0, maxInFlight: 0, onCall: () => undefined as void, gate: null as Promise<void> | null };
  const key = (cuit: string, pos: number, type: string) => `${cuit}|${pos}|${type}`;
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const track = async <T>(call: () => Promise<T>): Promise<T> => {
    calls.onCall();
    calls.inFlight++;
    calls.maxInFlight = Math.max(calls.maxInFlight, calls.inFlight);
    try {
      return await call();
    } finally {
      calls.inFlight--;
    }
  };
  const authorizer: FiscalAuthorizerPort = {
    lastAuthorizedNumber: (cuit, pos, type) =>
      track(async () => {
        await tick();
        if (behavior.next === 'throw-on-last') {
          behavior.next = 'approve';
          throw new Error('timeout');
        }
        return last.get(key(cuit, pos, type)) ?? 0;
      }),
    authorize: (request) =>
      track(async (): Promise<FiscalAuthorizationResult> => {
        requests.push(request);
        await tick();
        if (calls.gate) await calls.gate;
        const mode = behavior.next;
        behavior.next = 'approve';
        if (mode === 'throw') throw new Error('timeout');
        if (mode === 'reject') {
          return { approved: false, errors: [{ code: '10016', message: 'El numero o fecha del comprobante no se corresponde con el proximo a autorizar' }] };
        }
        last.set(key(request.issuerCuit, request.pointOfSale, request.receiptType), request.number);
        return { approved: true, number: request.number, cae: `7${String(request.number).padStart(13, '0')}`, caeExpiration: new Date('2026-11-04T00:00:00Z') };
      }),
  };
  return { authorizer, requests, behavior, last, calls };
};

interface Lease {
  receiptId: string;
  until: Date;
}

/**
 * In-memory unit of work: one queue per order and one per (business, point of sale, type) like the
 * row locks, and writes (receipts, sequence numbers and leases) buffered until the work resolves,
 * like the transaction. `locksHeld` counts the transactions running right now.
 */
export const fakeStore = () => {
  const receipts: Receipt[] = [];
  const sequences = new Map<string, number>();
  const leases = new Map<string, Lease>();
  const orderQueues = new Map<string, Promise<unknown>>();
  const sequenceQueues = new Map<string, Promise<unknown>>();
  const state = { locksHeld: 0 };
  const seqKey = (s: ReceiptSequenceScope) => `${s.businessId}|${s.pointOfSale}|${s.receiptType}`;
  const commit = (receipt: Receipt) => {
    const index = receipts.findIndex((r) => r.id === receipt.id);
    if (index >= 0) receipts[index] = receipt;
    else receipts.push(receipt);
  };
  const serialize = <T>(queues: Map<string, Promise<unknown>>, key: string, work: () => Promise<T>): Promise<T> => {
    const run = (queues.get(key) ?? Promise.resolve()).then(work);
    queues.set(key, run.catch(() => undefined));
    return run;
  };

  const transaction = async <T>(scope: ReceiptSequenceScope, work: (locked: LockedReceiptIssue) => Promise<T>): Promise<T> => {
    const key = seqKey(scope);
    let held = true;
    state.locksHeld++;
    const guard = () => {
      if (!held) throw new Error('repository used outside the issue lock');
    };
    const pending: Receipt[] = [];
    let lastNumber = sequences.get(key) ?? 0;
    let lease = leases.get(key) ?? null;
    const locked: LockedReceiptIssue = {
      receipts: fake({
        findByOrderId: async (orderId: string) => { guard(); return receipts.filter((r) => r.orderId === orderId); },
        save: async (r: Receipt) => { guard(); pending.push(r); },
      }),
      sequence: {
        lastNumber: async () => { guard(); return lastNumber; },
        advanceTo: async (n: number) => { guard(); lastNumber = n; },
        leaseHolder: async (now: Date) => { guard(); return lease && lease.until > now ? lease.receiptId : null; },
        claimLease: async (receiptId: string, until: Date) => { guard(); lease = { receiptId, until }; },
        releaseLease: async (receiptId: string) => { guard(); if (lease?.receiptId === receiptId) lease = null; },
      },
      isIssuing: async (receiptId: string, now: Date) => {
        guard();
        const all = new Map(leases);
        all.set(key, lease as Lease);
        return [...all.values()].some((l) => l && l.receiptId === receiptId && l.until > now);
      },
    };
    try {
      const result = await work(locked);
      pending.forEach(commit);
      sequences.set(key, lastNumber);
      if (lease) leases.set(key, lease);
      else leases.delete(key);
      return result;
    } finally {
      held = false;
      state.locksHeld--;
    }
  };

  const withIssueLock = jest.fn(<T>(scope: ReceiptIssueScope, work: (locked: LockedReceiptIssue) => Promise<T>) =>
    serialize(orderQueues, scope.orderId, () => serialize(sequenceQueues, seqKey(scope), () => transaction(scope, work))),
  );
  const withSequenceLock = jest.fn(<T>(scope: ReceiptSequenceScope, work: (locked: LockedReceiptIssue) => Promise<T>) =>
    serialize(sequenceQueues, seqKey(scope), () => transaction(scope, work)),
  );
  /** The order lock other operations (payments, status changes) take. */
  const withOrderLock = <T>(orderId: string, work: () => Promise<T>) => serialize(orderQueues, orderId, work);

  return {
    receipts,
    sequences,
    leases,
    state,
    seqKey,
    unitOfWork: fake<ReceiptIssueUnitOfWorkPort>({ withIssueLock, withSequenceLock }),
    withIssueLock,
    withSequenceLock,
    withOrderLock,
  };
};

export const setup = (ivaCondition: IVACondition = 'responsable_inscripto', orders: Order[] = [paidOrder()]) => {
  const store = fakeStore();
  const arca = fakeArca();
  const business = { id: 'biz-A', cuit: { value: ISSUER_CUIT }, settings: { ivaCondition, salePoint: '0003' } };
  const invoicing = new InvoicingUseCase(
    fake({ findByIdAndBusinessId: async (id: string, businessId: string) => orders.find((o) => o.id === id && o.businessId === businessId) ?? null }),
    fake({
      findByIdAndBusinessId: async (id: string, businessId: string) => store.receipts.find((r) => r.id === id && r.businessId === businessId) ?? null,
      findPageByBusinessId: async (businessId: string) => ({
        items: store.receipts
          .filter((r) => r.businessId === businessId)
          .map(({ items, ...fields }) => summarizeReceipt(fields, items.length)),
      }),
    }),
    fake({ findById: async (id: string) => (id === business.id ? business : null) }),
    store.unitOfWork,
    arca.authorizer,
  );
  const sequenceOf = (receiptType: string) => store.sequences.get(store.seqKey({ businessId: 'biz-A', pointOfSale: '0003', receiptType: receiptType as 'B' })) ?? 0;
  return { invoicing, store, arca, orders, sequenceOf };
};
