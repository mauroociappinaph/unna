import { Injectable } from '@nestjs/common';
import { LockedReceiptIssue, ReceiptIssueScope, ReceiptIssueUnitOfWorkPort } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaReceiptRepository, inOpenTransaction } from './receipt.repository.adapter';

/** The lock is held across the ARCA round trip, longer than Prisma's 5 s default. */
const ISSUE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

@Injectable()
export class PrismaReceiptIssueUnitOfWorkAdapter implements ReceiptIssueUnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {}

  withIssueLock<T>(scope: ReceiptIssueScope, work: (locked: LockedReceiptIssue) => Promise<T>): Promise<T> {
    const { businessId, orderId, pointOfSale, receiptType } = scope;
    return this.prisma.$transaction(async (tx) => {
      // Always the order first and the sequence second, so concurrent issues cannot deadlock.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND "businessId" = ${businessId} FOR UPDATE`;
      // Creates the row on the first issue without racing a concurrent first issue, then locks it.
      await tx.$executeRaw`
        INSERT INTO receipt_sequences ("businessId", "pointOfSale", "receiptType", "lastNumber", "updatedAt")
        VALUES (${businessId}, ${pointOfSale}, ${receiptType}, 0, NOW())
        ON CONFLICT DO NOTHING`;
      const [row] = await tx.$queryRaw<Array<{ lastNumber: number }>>`
        SELECT "lastNumber" FROM receipt_sequences
        WHERE "businessId" = ${businessId} AND "pointOfSale" = ${pointOfSale} AND "receiptType" = ${receiptType}
        FOR UPDATE`;

      let lastNumber = row.lastNumber;
      return work({
        receipts: new PrismaReceiptRepository(tx, inOpenTransaction),
        sequence: {
          lastNumber: async () => lastNumber,
          advanceTo: async (number) => {
            await tx.receiptSequence.update({
              where: { businessId_pointOfSale_receiptType: { businessId, pointOfSale, receiptType } },
              data: { lastNumber: number },
            });
            lastNumber = number;
          },
        },
      });
    }, ISSUE_TRANSACTION_OPTIONS);
  }
}
