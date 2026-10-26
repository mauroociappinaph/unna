import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaReceiptIssueUnitOfWorkAdapter } from '../receipt-sequence.adapter';
import { fake } from '../../use-cases/__tests__/test-doubles';

const scope = { businessId: 'biz-A', orderId: 'order-1', pointOfSale: '0003', receiptType: 'B' as const };
const pk = { businessId_pointOfSale_receiptType: { businessId: 'biz-A', pointOfSale: '0003', receiptType: 'B' } };
const NOW = new Date('2026-10-26T12:00:00Z');

interface SequenceRow {
  lastNumber: number;
  issuingReceiptId?: string | null;
  issuingUntil?: Date | null;
}

/** Records the statements run inside the interactive transaction. */
const fakePrisma = (row: SequenceRow, leasedElsewhere = 0) => {
  const statements: string[] = [];
  const updates: unknown[] = [];
  const updateManys: unknown[] = [];
  const counts: unknown[] = [];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((text, part, i) => text + part + (i < values.length ? `<${String(values[i])}>` : ''), '').replace(/\s+/g, ' ').trim();
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const statement = sql(strings, ...values);
      statements.push(statement);
      return statement.includes('FROM receipt_sequences') ? [{ issuingReceiptId: null, issuingUntil: null, ...row }] : [];
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      statements.push(sql(strings, ...values));
      return 0;
    },
    receiptSequence: {
      update: async (args: unknown) => { updates.push(args); },
      updateMany: async (args: unknown) => { updateManys.push(args); return { count: 1 }; },
      count: async (args: unknown) => { counts.push(args); return leasedElsewhere; },
    },
  };
  const options: unknown[] = [];
  const prisma = {
    $transaction: async (work: (client: typeof tx) => Promise<unknown>, ...transactionOptions: unknown[]) => {
      options.push(...transactionOptions);
      return work(tx);
    },
  };
  return { prisma: fake<PrismaService>(prisma), statements, updates, updateManys, counts, options };
};

const LOCK_SEQUENCE =
  'SELECT "lastNumber", "issuingReceiptId", "issuingUntil" FROM receipt_sequences WHERE "businessId" = <biz-A> AND "pointOfSale" = <0003> AND "receiptType" = <B> FOR UPDATE';

describe('PrismaReceiptIssueUnitOfWorkAdapter', () => {
  it('locks the order, then creates and locks the sequence row, before running the work', async () => {
    const { prisma, statements } = fakePrisma({ lastNumber: 41 });
    const unitOfWork = new PrismaReceiptIssueUnitOfWorkAdapter(prisma);

    const seen = await unitOfWork.withIssueLock(scope, async ({ sequence }) => sequence.lastNumber());

    expect(seen).toBe(41);
    expect(statements).toEqual([
      'SELECT id FROM orders WHERE id = <order-1> AND "businessId" = <biz-A> FOR UPDATE',
      'INSERT INTO receipt_sequences ("businessId", "pointOfSale", "receiptType", "lastNumber", "updatedAt") VALUES (<biz-A>, <0003>, <B>, 0, NOW()) ON CONFLICT DO NOTHING',
      LOCK_SEQUENCE,
    ]);
  });

  it('advances the locked sequence row and reports the new last number', async () => {
    const { prisma, updates } = fakePrisma({ lastNumber: 41 });
    const unitOfWork = new PrismaReceiptIssueUnitOfWorkAdapter(prisma);

    const after = await unitOfWork.withIssueLock(scope, async ({ sequence }) => {
      await sequence.advanceTo(42);
      return sequence.lastNumber();
    });

    expect(after).toBe(42);
    expect(updates).toEqual([{ where: pk, data: { lastNumber: 42 } }]);
  });

  it('runs short transactions with Prisma defaults: ARCA is never called inside (S18)', async () => {
    const { prisma, options } = fakePrisma({ lastNumber: 0 });
    const unitOfWork = new PrismaReceiptIssueUnitOfWorkAdapter(prisma);
    await unitOfWork.withIssueLock(scope, async () => undefined);
    await unitOfWork.withSequenceLock(scope, async () => undefined);
    expect(options).toEqual([]);
  });

  describe('issue lease (S18)', () => {
    it('reports the holder of an unexpired lease and nobody once it expired', async () => {
      const until = new Date(NOW.getTime() + 60_000);
      const { prisma } = fakePrisma({ lastNumber: 5, issuingReceiptId: 'receipt-9', issuingUntil: until });
      const unitOfWork = new PrismaReceiptIssueUnitOfWorkAdapter(prisma);

      const holders = await unitOfWork.withIssueLock(scope, async ({ sequence }) => [
        await sequence.leaseHolder(NOW),
        await sequence.leaseHolder(until),
      ]);

      expect(holders).toEqual(['receipt-9', null]);
    });

    it('claims the lease on the locked row and frees it only for its holder', async () => {
      const until = new Date(NOW.getTime() + 120_000);
      const { prisma, updates, updateManys } = fakePrisma({ lastNumber: 5 });
      const unitOfWork = new PrismaReceiptIssueUnitOfWorkAdapter(prisma);

      const holder = await unitOfWork.withIssueLock(scope, async ({ sequence }) => {
        await sequence.claimLease('receipt-1', until);
        return sequence.leaseHolder(NOW);
      });
      await unitOfWork.withSequenceLock(scope, async ({ sequence }) => sequence.releaseLease('receipt-1'));

      expect(holder).toBe('receipt-1');
      expect(updates).toEqual([{ where: pk, data: { issuingReceiptId: 'receipt-1', issuingUntil: until } }]);
      expect(updateManys).toEqual([
        { where: { businessId: 'biz-A', pointOfSale: '0003', receiptType: 'B', issuingReceiptId: 'receipt-1' }, data: { issuingReceiptId: null, issuingUntil: null } },
      ]);
    });

    it('tells whether a receipt holds an unexpired lease of any sequence of the business', async () => {
      const { prisma, counts } = fakePrisma({ lastNumber: 0 }, 1);
      const unitOfWork = new PrismaReceiptIssueUnitOfWorkAdapter(prisma);

      const issuing = await unitOfWork.withIssueLock(scope, async (locked) => locked.isIssuing('receipt-1', NOW));

      expect(issuing).toBe(true);
      expect(counts).toEqual([{ where: { businessId: 'biz-A', issuingReceiptId: 'receipt-1', issuingUntil: { gt: NOW } } }]);
    });

    it('confirms with only the sequence row locked, never the order', async () => {
      const { prisma, statements } = fakePrisma({ lastNumber: 7 });
      const unitOfWork = new PrismaReceiptIssueUnitOfWorkAdapter(prisma);

      const seen = await unitOfWork.withSequenceLock({ businessId: 'biz-A', pointOfSale: '0003', receiptType: 'B' }, async ({ sequence }) => sequence.lastNumber());

      expect(seen).toBe(7);
      expect(statements).toEqual([LOCK_SEQUENCE]);
    });
  });
});
