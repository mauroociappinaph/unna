import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaReceiptIssueUnitOfWorkAdapter } from '../receipt-sequence.adapter';
import { fake } from '../../use-cases/__tests__/test-doubles';

const scope = { businessId: 'biz-A', orderId: 'order-1', pointOfSale: '0003', receiptType: 'B' as const };

/** Records the statements run inside the interactive transaction. */
const fakePrisma = (lastNumber: number) => {
  const statements: string[] = [];
  const updates: unknown[] = [];
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) =>
    strings.reduce((text, part, i) => text + part + (i < values.length ? `<${String(values[i])}>` : ''), '').replace(/\s+/g, ' ').trim();
  const tx = {
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      statements.push(sql(strings, ...values));
      return statements.length === 3 ? [{ lastNumber }] : [];
    },
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      statements.push(sql(strings, ...values));
      return 0;
    },
    receiptSequence: { update: async (args: unknown) => { updates.push(args); } },
  };
  const options: unknown[] = [];
  const prisma = {
    $transaction: async (work: (client: typeof tx) => Promise<unknown>, transactionOptions: unknown) => {
      options.push(transactionOptions);
      return work(tx);
    },
  };
  return { prisma: fake<PrismaService>(prisma), statements, updates, options };
};

describe('PrismaReceiptIssueUnitOfWorkAdapter', () => {
  it('locks the order, then creates and locks the sequence row, before running the work', async () => {
    const { prisma, statements } = fakePrisma(41);
    const unitOfWork = new PrismaReceiptIssueUnitOfWorkAdapter(prisma);

    const seen = await unitOfWork.withIssueLock(scope, async ({ sequence }) => sequence.lastNumber());

    expect(seen).toBe(41);
    expect(statements).toEqual([
      'SELECT id FROM orders WHERE id = <order-1> AND "businessId" = <biz-A> FOR UPDATE',
      'INSERT INTO receipt_sequences ("businessId", "pointOfSale", "receiptType", "lastNumber", "updatedAt") VALUES (<biz-A>, <0003>, <B>, 0, NOW()) ON CONFLICT DO NOTHING',
      'SELECT "lastNumber" FROM receipt_sequences WHERE "businessId" = <biz-A> AND "pointOfSale" = <0003> AND "receiptType" = <B> FOR UPDATE',
    ]);
  });

  it('advances the locked sequence row and reports the new last number', async () => {
    const { prisma, updates } = fakePrisma(41);
    const unitOfWork = new PrismaReceiptIssueUnitOfWorkAdapter(prisma);

    const after = await unitOfWork.withIssueLock(scope, async ({ sequence }) => {
      await sequence.advanceTo(42);
      return sequence.lastNumber();
    });

    expect(after).toBe(42);
    expect(updates).toEqual([
      { where: { businessId_pointOfSale_receiptType: { businessId: 'biz-A', pointOfSale: '0003', receiptType: 'B' } }, data: { lastNumber: 42 } },
    ]);
  });

  it('gives the transaction room for the ARCA round trip', async () => {
    const { prisma, options } = fakePrisma(0);
    await new PrismaReceiptIssueUnitOfWorkAdapter(prisma).withIssueLock(scope, async () => undefined);
    expect(options).toEqual([{ maxWait: 10_000, timeout: 30_000 }]);
  });
});
