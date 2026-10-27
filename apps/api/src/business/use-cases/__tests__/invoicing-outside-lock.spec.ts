import { Logger } from '@nestjs/common';
import { Receipt } from '@unna/domain';
import { FiscalAuthorizerUnavailableError } from '../invoicing.use-case';
import { paidOrder, setup } from './invoicing-fakes';

const B_SEQUENCE = 'biz-A|0003|B';
const MINUTE = 60 * 1000;

/** Records how many transactions were open on every ARCA call. */
const recordLocksDuringArcaCalls = (ctx: ReturnType<typeof setup>) => {
  const locksDuringCall: number[] = [];
  ctx.arca.calls.onCall = () => {
    locksDuringCall.push(ctx.store.state.locksHeld);
  };
  return locksDuringCall;
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('InvoicingUseCase.issueReceipt calls ARCA without locks (S18)', () => {
  it('reserves the number in a short transaction, asks ARCA with no transaction open and confirms in another', async () => {
    const ctx = setup();
    const locksDuringCall = recordLocksDuringArcaCalls(ctx);

    const result = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });

    expect(result.value).toMatchObject({ status: 'issued', invoiceNumber: 1 });
    expect(locksDuringCall).toEqual([0, 0]);
    expect(ctx.store.withIssueLock).toHaveBeenCalledTimes(1);
    expect(ctx.store.withSequenceLock).toHaveBeenCalledWith({ businessId: 'biz-A', pointOfSale: '0003', receiptType: 'B' }, expect.any(Function));
    expect(ctx.store.leases.size).toBe(0);
  });

  it('gives two concurrent issues of one point of sale consecutive numbers, one ARCA call at a time', async () => {
    const ctx = setup('responsable_inscripto', [paidOrder(), paidOrder()]);

    const results = await Promise.all(ctx.orders.map((o) => ctx.invoicing.issueReceipt('biz-A', o.id, { type: 'B' })));

    expect(results.map((r) => r.value?.invoiceNumber).sort()).toEqual([1, 2]);
    expect(ctx.arca.requests.map((r) => r.number)).toEqual([1, 2]);
    expect(ctx.arca.calls.maxInFlight).toBe(1);
    expect(ctx.sequenceOf('B')).toBe(2);
    expect(ctx.store.leases.size).toBe(0);
  });

  it('does not consume the number on a rejection: the draft is retriable and the lease is free', async () => {
    const ctx = setup('responsable_inscripto', [paidOrder(), paidOrder()]);
    ctx.arca.behavior.next = 'reject';

    const rejected = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });
    const other = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[1].id, { type: 'B' });

    expect(rejected.ok).toBe(false);
    expect(ctx.store.receipts[0]).toMatchObject({ status: 'draft', invoiceNumber: undefined });
    expect(other.value).toMatchObject({ status: 'issued', invoiceNumber: 1 });
    expect(ctx.store.leases.size).toBe(0);
    expect((await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' })).value).toMatchObject({ id: ctx.store.receipts[0].id, invoiceNumber: 2 });
  });

  it('leaves a retriable draft and frees the lease when ARCA times out', async () => {
    const ctx = setup();
    ctx.arca.behavior.next = 'throw';

    const failed = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });

    expect(failed.error).toBeInstanceOf(FiscalAuthorizerUnavailableError);
    expect(ctx.store.receipts).toEqual([expect.objectContaining({ status: 'draft', authorizationError: 'ARCA no respondió: timeout' })]);
    expect(ctx.store.leases.size).toBe(0);
    expect(ctx.sequenceOf('B')).toBe(0);
    expect((await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' })).value).toMatchObject({ status: 'issued', invoiceNumber: 1 });
  });

  it('lets other operations take the order lock while ARCA is authorizing', async () => {
    const ctx = setup();
    const gate = deferred();
    ctx.arca.calls.gate = gate.promise;

    const issuing = ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(ctx.arca.calls.inFlight).toBe(1);

    const payment = await Promise.race([
      ctx.store.withOrderLock(ctx.orders[0].id, async () => 'paid'),
      new Promise((resolve) => setTimeout(() => resolve('blocked'), 100)),
    ]);
    expect(payment).toBe('paid');
    expect(ctx.store.state.locksHeld).toBe(0);

    gate.resolve();
    expect((await issuing).value).toMatchObject({ status: 'issued', invoiceNumber: 1 });
  });

  it('gives an order one receipt when a ticket is asked while its factura is being authorized', async () => {
    const ctx = setup();
    const gate = deferred();
    ctx.arca.calls.gate = gate.promise;

    const factura = ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const ticket = ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'ticket' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    gate.resolve();

    expect((await factura).value).toMatchObject({ status: 'issued', receiptNumber: 'B-0003-00000001' });
    expect((await ticket).error?.message).toBe('El pedido ya tiene un comprobante');
    expect(ctx.store.receipts).toHaveLength(1);
    expect(ctx.sequenceOf('ticket')).toBe(0);
  });

  it('takes over a lease abandoned by a crashed issue', async () => {
    const ctx = setup();
    ctx.store.leases.set(B_SEQUENCE, { receiptId: 'crashed', until: new Date(Date.now() - MINUTE) });

    const result = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });

    expect(result.value).toMatchObject({ status: 'issued', invoiceNumber: 1 });
    expect(ctx.store.leases.size).toBe(0);
  });

  it('waits for the lease of another issue in flight instead of asking ARCA at the same time', async () => {
    const ctx = setup();
    ctx.store.leases.set(B_SEQUENCE, { receiptId: 'other', until: new Date(Date.now() + MINUTE) });
    setTimeout(() => {
      ctx.store.leases.delete(B_SEQUENCE);
      ctx.arca.last.set('30712345671|3|B', 1);
      ctx.store.sequences.set(B_SEQUENCE, 1);
    }, 50);

    const result = await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });

    expect(result.value).toMatchObject({ status: 'issued', invoiceNumber: 2 });
    expect(ctx.arca.requests.map((r) => r.number)).toEqual([2]);
  });

  it('gives up waiting for a lease that is not released, without calling ARCA nor writing', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const ctx = setup();
      ctx.store.leases.set(B_SEQUENCE, { receiptId: 'other', until: new Date(Date.now() + 10 * MINUTE) });

      const pending = ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' });
      await jest.advanceTimersByTimeAsync(35_000);

      expect(await pending).toEqual({ ok: false, error: new Error('Se está emitiendo otro comprobante en este punto de venta. Probá de nuevo en unos segundos') });
      expect(ctx.arca.requests).toHaveLength(0);
      expect(ctx.store.receipts).toHaveLength(0);
      expect(ctx.store.leases.get(B_SEQUENCE)?.receiptId).toBe('other');
    } finally {
      jest.useRealTimers();
    }
  });

  describe('never leaves the sequence lease held by mistake', () => {
    const DB_DOWN = new Error('db down');
    const NOT_SAVED = 'ARCA aprobó el comprobante pero no se pudo guardar. No lo vuelvas a emitir; contactá a soporte.';

    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    /** Under fake timers, steps the clock until the issue settles (ARCA's double answers on real setImmediate ticks). */
    const settle = async <T>(pending: Promise<T>): Promise<T> => {
      let done = false;
      pending.then(() => { done = true; }, () => { done = true; });
      for (let step = 0; step < 100 && !done; step++) {
        await new Promise((resolve) => setImmediate(resolve));
        await jest.advanceTimersByTimeAsync(100);
      }
      return pending;
    };

    it('frees the lease when something throws between the reservation and ARCA, so the draft is retriable at once', async () => {
      const ctx = setup();
      jest.spyOn(Receipt.prototype, 'setCaeRequest').mockImplementationOnce(() => {
        throw new Error('boom');
      });

      await expect(ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' })).rejects.toThrow('boom');

      expect(ctx.store.leases.size).toBe(0);
      expect(ctx.arca.requests).toHaveLength(0);
      expect((await ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' })).value).toMatchObject({ status: 'issued', invoiceNumber: 1 });
    });

    it('frees the lease when saving a rejection fails', async () => {
      const ctx = setup();
      ctx.arca.behavior.next = 'reject';
      ctx.store.withSequenceLock.mockRejectedValueOnce(DB_DOWN);

      await expect(ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' })).rejects.toThrow('db down');

      expect(ctx.store.leases.size).toBe(0);
      expect(ctx.sequenceOf('B')).toBe(0);
    });

    it('retries saving an approved receipt, so a brief database failure does not lose it', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      const ctx = setup();
      ctx.store.withSequenceLock.mockRejectedValueOnce(DB_DOWN).mockRejectedValueOnce(DB_DOWN);

      const result = await settle(ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' }));

      expect(result.value).toMatchObject({ status: 'issued', invoiceNumber: 1 });
      expect(ctx.store.withSequenceLock).toHaveBeenCalledTimes(3);
      expect(ctx.arca.requests).toHaveLength(1);
      expect(ctx.sequenceOf('B')).toBe(1);
      expect(ctx.store.leases.size).toBe(0);
    });

    it('keeps the lease and asks not to issue again when the approved receipt still cannot be saved', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      const ctx = setup();
      ctx.store.withSequenceLock.mockRejectedValue(DB_DOWN);
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const result = await settle(ctx.invoicing.issueReceipt('biz-A', ctx.orders[0].id, { type: 'B' }));

      expect(result).toEqual({ ok: false, error: new Error(NOT_SAVED) });
      expect(ctx.store.withSequenceLock).toHaveBeenCalledTimes(3);
      expect(ctx.arca.requests).toHaveLength(1);
      // No second number is asked for while the approved one is unconfirmed.
      expect(ctx.store.leases.get(B_SEQUENCE)?.receiptId).toBe(ctx.store.receipts[0].id);
      expect(ctx.store.receipts[0]).toMatchObject({ status: 'draft' });
      // Support can find the approved number and CAE in the logs.
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('(número 1, CAE 70000000000001)'));
    });
  });
});
