import { FiscalAuthorizerUnavailableError, InvoicingUseCase } from '../invoicing.use-case';
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
} from '@unna/domain';
import { fake } from './test-doubles';

const m = (cents: number) => Money.fromCents(cents);
const ISSUER_CUIT = '30712345671';
const CUSTOMER_CUIT = '20123456786';

type NewOrderLine = Parameters<Order['addItem']>[0];
const line = (net: number, taxRate: number): NewOrderLine => ({
  productId: `p-${taxRate}`,
  productName: `Producto ${taxRate}`,
  quantity: 1,
  unitPrice: m(net),
  totalPrice: m(net),
  taxRate,
  taxAmount: m(net).percentage(taxRate),
  modifiers: [],
});

const paidOrder = (lines: NewOrderLine[] = [line(1000, 21)], discount = 0) => {
  let order = Order.create({ businessId: 'biz-A', sucursalId: 'suc-1', sucursalName: 'Central', type: 'takeaway', items: lines });
  if (discount) order = order.applyDiscount(m(discount));
  return order.markPaymentCompleted('cash');
};

/** ARCA double: remembers the last number per (issuer, point of sale, type) and answers after a tick. */
const fakeArca = () => {
  const last = new Map<string, number>();
  const requests: FiscalAuthorizationRequest[] = [];
  const behavior: { next: 'approve' | 'reject' | 'throw' | 'throw-on-last' } = { next: 'approve' };
  const key = (cuit: string, pos: number, type: string) => `${cuit}|${pos}|${type}`;
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const authorizer: FiscalAuthorizerPort = {
    lastAuthorizedNumber: async (cuit, pos, type) => {
      await tick();
      if (behavior.next === 'throw-on-last') {
        behavior.next = 'approve';
        throw new Error('timeout');
      }
      return last.get(key(cuit, pos, type)) ?? 0;
    },
    authorize: async (request): Promise<FiscalAuthorizationResult> => {
      requests.push(request);
      await tick();
      const mode = behavior.next;
      behavior.next = 'approve';
      if (mode === 'throw') throw new Error('timeout');
      if (mode === 'reject') {
        return { approved: false, errors: [{ code: '10016', message: 'El numero o fecha del comprobante no se corresponde con el proximo a autorizar' }] };
      }
      last.set(key(request.issuerCuit, request.pointOfSale, request.receiptType), request.number);
      return { approved: true, number: request.number, cae: `7${String(request.number).padStart(13, '0')}`, caeExpiration: new Date('2026-11-04T00:00:00Z') };
    },
  };
  return { authorizer, requests, behavior, last };
};

/**
 * In-memory unit of work: one queue per (business, point of sale, type) like the row lock, and
 * writes buffered until the work resolves, like the transaction.
 */
const fakeStore = () => {
  const receipts: Receipt[] = [];
  const sequences = new Map<string, number>();
  const queues = new Map<string, Promise<unknown>>();
  const seqKey = (s: Pick<ReceiptIssueScope, 'businessId' | 'pointOfSale' | 'receiptType'>) => `${s.businessId}|${s.pointOfSale}|${s.receiptType}`;
  const commit = (receipt: Receipt) => {
    const index = receipts.findIndex((r) => r.id === receipt.id);
    if (index >= 0) receipts[index] = receipt;
    else receipts.push(receipt);
  };

  const withIssueLock = jest.fn(<T>(scope: ReceiptIssueScope, work: (locked: LockedReceiptIssue) => Promise<T>) => {
    const key = seqKey(scope);
    const run = (queues.get(key) ?? Promise.resolve()).then(async () => {
      let held = true;
      const guard = () => {
        if (!held) throw new Error('repository used outside the issue lock');
      };
      const pending: Receipt[] = [];
      let lastNumber = sequences.get(key) ?? 0;
      const locked: LockedReceiptIssue = {
        receipts: fake({
          findByOrderId: async (orderId: string) => { guard(); return receipts.filter((r) => r.orderId === orderId); },
          save: async (r: Receipt) => { guard(); pending.push(r); },
        }),
        sequence: {
          lastNumber: async () => { guard(); return lastNumber; },
          advanceTo: async (n: number) => { guard(); lastNumber = n; },
        },
      };
      try {
        const result = await work(locked);
        pending.forEach(commit);
        sequences.set(key, lastNumber);
        return result;
      } finally {
        held = false;
      }
    });
    queues.set(key, run.catch(() => undefined));
    return run;
  });

  return { receipts, sequences, seqKey, unitOfWork: fake<ReceiptIssueUnitOfWorkPort>({ withIssueLock }), withIssueLock };
};

const setup = (ivaCondition: IVACondition = 'responsable_inscripto', orders: Order[] = [paidOrder()]) => {
  const store = fakeStore();
  const arca = fakeArca();
  const business = { id: 'biz-A', cuit: { value: ISSUER_CUIT }, settings: { ivaCondition, salePoint: '0003' } };
  const invoicing = new InvoicingUseCase(
    fake({ findByIdAndBusinessId: async (id: string, businessId: string) => orders.find((o) => o.id === id && o.businessId === businessId) ?? null }),
    fake({
      findByIdAndBusinessId: async (id: string, businessId: string) => store.receipts.find((r) => r.id === id && r.businessId === businessId) ?? null,
      findByBusinessId: async (businessId: string) => store.receipts.filter((r) => r.businessId === businessId),
    }),
    fake({ findById: async (id: string) => (id === business.id ? business : null) }),
    store.unitOfWork,
    arca.authorizer,
  );
  const sequenceOf = (receiptType: string) => store.sequences.get(store.seqKey({ businessId: 'biz-A', pointOfSale: '0003', receiptType: receiptType as 'B' })) ?? 0;
  return { invoicing, store, arca, orders, sequenceOf };
};

const decodeQr = (url: string) => JSON.parse(Buffer.from(url.split('?p=')[1], 'base64').toString());

describe('InvoicingUseCase.issueReceipt', () => {
  describe('ticket', () => {
    it('issues immediately with its own sequential number and never calls ARCA', async () => {
      const { invoicing, store, arca, orders, sequenceOf } = setup('responsable_inscripto', [paidOrder(), paidOrder()]);

      const first = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'ticket' });
      const second = await invoicing.issueReceipt('biz-A', orders[1].id, { type: 'ticket' });

      expect(first.value).toMatchObject({ status: 'issued', invoiceNumber: 1, receiptNumber: 'ticket-0003-00000001' });
      expect(second.value).toMatchObject({ status: 'issued', invoiceNumber: 2, receiptNumber: 'ticket-0003-00000002' });
      expect(arca.requests).toHaveLength(0);
      expect(store.receipts).toHaveLength(2);
      expect(sequenceOf('ticket')).toBe(2);
    });

    it('keeps a sequence separate from fiscal receipts', async () => {
      const { invoicing, orders } = setup('responsable_inscripto', [paidOrder(), paidOrder(), paidOrder()]);

      const b1 = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'B' });
      const t1 = await invoicing.issueReceipt('biz-A', orders[1].id, { type: 'ticket' });
      const b2 = await invoicing.issueReceipt('biz-A', orders[2].id, { type: 'B' });

      expect([b1.value!.receiptNumber, t1.value!.receiptNumber, b2.value!.receiptNumber]).toEqual([
        'B-0003-00000001',
        'ticket-0003-00000001',
        'B-0003-00000002',
      ]);
    });
  });

  describe('fiscal receipts', () => {
    it('authorizes a B for a consumidor final and stores CAE, expiration, number and QR', async () => {
      const { invoicing, store, arca, orders, sequenceOf } = setup();

      const result = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'B' });

      expect(result.ok).toBe(true);
      expect(result.value).toMatchObject({
        status: 'issued',
        invoiceNumber: 1,
        receiptNumber: 'B-0003-00000001',
        cae: '70000000000001',
        caeExpiration: new Date('2026-11-04T00:00:00Z'),
        docType: 99,
        docNumber: '0',
      });
      expect(result.value!.authorizationError).toBeUndefined();
      expect(arca.requests[0]).toMatchObject({
        issuerCuit: ISSUER_CUIT,
        pointOfSale: 3,
        receiptType: 'B',
        number: 1,
        concept: 1,
        docType: 99,
        docNumber: '0',
        receiverVatCondition: 5,
        netAmount: 1000,
        exemptAmount: 0,
        ivaAmount: 210,
        totalAmount: 1210,
        ivaBreakdown: [{ rate: 21, base: 1000, amount: 210 }],
        currency: 'PES',
      });
      expect(decodeQr(result.value!.qrCode!)).toMatchObject({
        cuit: Number(ISSUER_CUIT),
        ptoVta: 3,
        tipoCmp: 6,
        nroCmp: 1,
        importe: 12.1,
        tipoDocRec: 99,
        nroDocRec: 0,
        codAut: 70000000000001,
      });
      expect(store.receipts).toEqual([result.value]);
      expect(sequenceOf('B')).toBe(1);
    });

    it('sends an A with IVA per rate and the discount spread to the cent of the order total', async () => {
      const order = paidOrder([line(1000, 21), line(1000, 10.5)], 100);
      const { invoicing, arca } = setup('responsable_inscripto', [order]);

      const result = await invoicing.issueReceipt('biz-A', order.id, { type: 'A', customerTaxId: '20-12345678-6', customerCondition: 'responsable_inscripto' });

      expect(result.ok).toBe(true);
      expect(arca.requests[0]).toMatchObject({
        receiptType: 'A',
        docType: 80,
        docNumber: CUSTOMER_CUIT,
        receiverVatCondition: 1,
        netAmount: 1914,
        ivaAmount: 301,
        totalAmount: order.totalAmount.toCents(),
        ivaBreakdown: [
          { rate: 21, base: 957, amount: 201 },
          { rate: 10.5, base: 957, amount: 100 },
        ],
      });
      expect(order.totalAmount.toCents()).toBe(2215);
      expect(result.value).toMatchObject({ customerTaxId: CUSTOMER_CUIT, ivaBreakdown: arca.requests[0].ivaBreakdown });
    });

    it('sends a C with the whole total as net and no IVA', async () => {
      const order = paidOrder([line(1000, 21), line(1000, 10.5)], 100);
      const { invoicing, arca } = setup('monotributo', [order]);

      const result = await invoicing.issueReceipt('biz-A', order.id, { type: 'C' });

      expect(result.value).toMatchObject({ status: 'issued', receiptNumber: 'C-0003-00000001', ivaBreakdown: [] });
      expect(arca.requests[0]).toMatchObject({ receiptType: 'C', netAmount: 2215, ivaAmount: 0, totalAmount: 2215, ivaBreakdown: [] });
    });

    it('numbers from the highest of the local sequence and the last number ARCA authorized', async () => {
      const { invoicing, store, arca, orders, sequenceOf } = setup('responsable_inscripto', [paidOrder(), paidOrder()]);
      store.sequences.set(store.seqKey({ businessId: 'biz-A', pointOfSale: '0003', receiptType: 'B' }), 7);
      arca.last.set(`${ISSUER_CUIT}|3|B`, 5);

      const ahead = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'B' });
      arca.last.set(`${ISSUER_CUIT}|3|B`, 20);
      const behind = await invoicing.issueReceipt('biz-A', orders[1].id, { type: 'B' });

      expect(ahead.value!.invoiceNumber).toBe(8);
      expect(behind.value!.invoiceNumber).toBe(21);
      expect(sequenceOf('B')).toBe(21);
    });

    it('gives concurrent issues distinct consecutive numbers', async () => {
      const orders = Array.from({ length: 5 }, () => paidOrder());
      const { invoicing, arca, sequenceOf } = setup('responsable_inscripto', orders);

      const results = await Promise.all(orders.map((o) => invoicing.issueReceipt('biz-A', o.id, { type: 'B' })));

      expect(results.every((r) => r.ok)).toBe(true);
      expect(results.map((r) => r.value!.invoiceNumber).sort()).toEqual([1, 2, 3, 4, 5]);
      expect(arca.requests.map((r) => r.number)).toEqual([1, 2, 3, 4, 5]);
      expect(sequenceOf('B')).toBe(5);
    });
  });

  describe('rejected input writes nothing', () => {
    const expectNothingWritten = (ctx: ReturnType<typeof setup>) => {
      expect(ctx.store.withIssueLock).not.toHaveBeenCalled();
      expect(ctx.store.receipts).toHaveLength(0);
      expect(ctx.store.sequences.size).toBe(0);
      expect(ctx.arca.requests).toHaveLength(0);
    };

    it('rejects a factura A without the customer CUIT', async () => {
      const ctx = setup();
      const result = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'A' });
      expect(result.error?.message).toBe('La factura A requiere el CUIT del cliente');
      expectNothingWritten(ctx);
    });

    it('rejects a type the business IVA condition cannot issue', async () => {
      const ctx = setup('monotributo');
      const result = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });
      expect(result.error?.message).toBe('Un monotributista solo puede emitir factura C');
      expectNothingWritten(ctx);
    });

    it('rejects an order that is not fully paid', async () => {
      const unpaid = Order.create({ businessId: 'biz-A', sucursalId: 'suc-1', sucursalName: 'Central', type: 'takeaway', items: [line(1000, 21)] });
      const ctx = setup('responsable_inscripto', [unpaid]);
      const result = await ctx.invoicing.issueReceipt('biz-A', unpaid.id, { type: 'ticket' });
      expect(result.error?.message).toBe('El pedido debe estar pagado para emitir un comprobante');
      expectNothingWritten(ctx);
    });

    it('rejects an unknown order, including one of another business', async () => {
      const ctx = setup();
      expect((await ctx.invoicing.issueReceipt('biz-B', ctx.orders[0].id, { type: 'ticket' })).error?.message).toBe('Pedido no encontrado');
      expectNothingWritten(ctx);
    });

    it('rejects an invalid receipt type', async () => {
      const ctx = setup();
      const result = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'proforma' as 'ticket' });
      expect(result.error?.message).toBe('Tipo de comprobante inválido');
      expectNothingWritten(ctx);
    });

    it('rejects a second receipt for an order that already has one issued', async () => {
      const ctx = setup();
      await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });

      const again = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'ticket' });

      expect(again.error?.message).toBe('El pedido ya tiene un comprobante');
      expect(ctx.store.receipts).toHaveLength(1);
      expect(ctx.arca.requests).toHaveLength(1);
      expect(ctx.sequenceOf('ticket')).toBe(0);
    });
  });

  describe('ARCA rejection or failure', () => {
    it('keeps a draft with ARCA message, leaves no number gap, and the retry reuses the draft', async () => {
      const { invoicing, store, arca, orders, sequenceOf } = setup();
      arca.behavior.next = 'reject';

      const rejected = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'B' });

      const message = 'ARCA rechazó el comprobante: 10016 - El numero o fecha del comprobante no se corresponde con el proximo a autorizar';
      expect(rejected.ok).toBe(false);
      expect(rejected.error?.message).toBe(message);
      expect(rejected.error).not.toBeInstanceOf(FiscalAuthorizerUnavailableError);
      expect(store.receipts).toHaveLength(1);
      const draft = store.receipts[0];
      expect(draft).toMatchObject({ status: 'draft', authorizationError: message, invoiceNumber: undefined, cae: undefined });
      expect(sequenceOf('B')).toBe(0);

      const retry = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'B' });

      expect(retry.value).toMatchObject({ id: draft.id, status: 'issued', invoiceNumber: 1, receiptNumber: 'B-0003-00000001' });
      expect(retry.value!.authorizationError).toBeUndefined();
      expect(store.receipts).toHaveLength(1);
      expect(arca.requests.map((r) => r.number)).toEqual([1, 1]);
      expect(sequenceOf('B')).toBe(1);
    });

    it('lets the retry fix the customer and switch the draft to another type', async () => {
      const { invoicing, store, arca, orders } = setup();
      arca.behavior.next = 'reject';
      await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'B' });
      const draftId = store.receipts[0].id;

      const retry = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'A', customerTaxId: CUSTOMER_CUIT, customerCondition: 'monotributo' });

      expect(retry.value).toMatchObject({ id: draftId, type: 'A', receiptNumber: 'A-0003-00000001', docType: 80 });
      expect(store.receipts).toHaveLength(1);
    });

    it('rejects a factura A without the customer IVA condition before writing anything (RG 5616)', async () => {
      const { invoicing, store, arca, orders } = setup();

      const result = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'A', customerTaxId: CUSTOMER_CUIT });

      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe('La factura A requiere la condición frente al IVA del cliente');
      expect(store.receipts).toHaveLength(0);
      expect(arca.requests).toHaveLength(0);
    });

    it('keeps a retriable draft and reports ARCA unavailable when the call fails', async () => {
      const { invoicing, store, arca, orders, sequenceOf } = setup();
      arca.behavior.next = 'throw';

      const failed = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'B' });

      expect(failed.ok).toBe(false);
      expect(failed.error).toBeInstanceOf(FiscalAuthorizerUnavailableError);
      expect(failed.error?.message).toBe('ARCA no está disponible en este momento; el comprobante quedó en borrador y podés reintentarlo');
      expect(store.receipts).toHaveLength(1);
      expect(store.receipts[0]).toMatchObject({ status: 'draft', authorizationError: 'ARCA no respondió: timeout' });
      expect(sequenceOf('B')).toBe(0);

      const retry = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'B' });

      expect(retry.value).toMatchObject({ id: store.receipts[0].id, status: 'issued', invoiceNumber: 1 });
      expect(store.receipts).toHaveLength(1);
    });

    it('treats a failure asking ARCA for the last number as unavailable too', async () => {
      const { invoicing, store, arca, orders } = setup();
      arca.behavior.next = 'throw-on-last';

      const failed = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'B' });

      expect(failed.error).toBeInstanceOf(FiscalAuthorizerUnavailableError);
      expect(arca.requests).toHaveLength(0);
      expect(store.receipts[0]).toMatchObject({ status: 'draft', authorizationError: 'ARCA no respondió: timeout' });
    });
  });
});

describe('InvoicingUseCase reads', () => {
  it('gets and lists only the business receipts', async () => {
    const { invoicing, orders } = setup();
    const issued = await invoicing.issueReceipt('biz-A', orders[0].id, { type: 'ticket' });

    expect((await invoicing.getReceipt('biz-A', issued.value!.id)).value).toBe(issued.value);
    expect((await invoicing.getReceipt('biz-B', issued.value!.id)).error?.message).toBe('Comprobante no encontrado');
    expect((await invoicing.listReceipts('biz-A')).value).toEqual([issued.value]);
    expect((await invoicing.listReceipts('biz-B')).value).toEqual([]);
  });
});
