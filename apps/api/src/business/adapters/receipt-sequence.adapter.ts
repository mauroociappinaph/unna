import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LockedReceiptIssue, ReceiptIssueScope, ReceiptIssueUnitOfWorkPort, ReceiptSequenceScope } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaReceiptRepository, inOpenTransaction } from './receipt.repository.adapter';

type Tx = Prisma.TransactionClient;

interface SequenceRow {
  lastNumber: number;
  issuingReceiptId: string | null;
  issuingUntil: Date | null;
}

/**
 * Short transactions only (Prisma's default timeout): ARCA is called between them, never inside,
 * and the sequence lease keeps one authorization per sequence in flight (S18).
 */
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
      return work(await lockSequence(tx, scope));
    });
  }

  withSequenceLock<T>(scope: ReceiptSequenceScope, work: (locked: LockedReceiptIssue) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => work(await lockSequence(tx, scope)));
  }
}

/** Locks the sequence row (created by withIssueLock) and binds the repositories to the transaction. */
async function lockSequence(tx: Tx, scope: ReceiptSequenceScope): Promise<LockedReceiptIssue> {
  const { businessId, pointOfSale, receiptType } = scope;
  const [row] = await tx.$queryRaw<SequenceRow[]>`
    SELECT "lastNumber", "issuingReceiptId", "issuingUntil" FROM receipt_sequences
    WHERE "businessId" = ${businessId} AND "pointOfSale" = ${pointOfSale} AND "receiptType" = ${receiptType}
    FOR UPDATE`;
  const where = { businessId_pointOfSale_receiptType: { businessId, pointOfSale, receiptType } };
  let { lastNumber, issuingReceiptId, issuingUntil } = row ?? { lastNumber: 0, issuingReceiptId: null, issuingUntil: null };

  return {
    receipts: new PrismaReceiptRepository(tx, inOpenTransaction),
    sequence: {
      lastNumber: async () => lastNumber,
      advanceTo: async (number) => {
        await tx.receiptSequence.update({ where, data: { lastNumber: number } });
        lastNumber = number;
      },
      leaseHolder: async (now) => (issuingUntil && issuingUntil > now ? issuingReceiptId : null),
      claimLease: async (receiptId, until) => {
        await tx.receiptSequence.update({ where, data: { issuingReceiptId: receiptId, issuingUntil: until } });
        issuingReceiptId = receiptId;
        issuingUntil = until;
      },
      releaseLease: async (receiptId) => {
        await tx.receiptSequence.updateMany({
          where: { businessId, pointOfSale, receiptType, issuingReceiptId: receiptId },
          data: { issuingReceiptId: null, issuingUntil: null },
        });
        if (issuingReceiptId === receiptId) {
          issuingReceiptId = null;
          issuingUntil = null;
        }
      },
    },
    isIssuing: async (receiptId, now) =>
      (await tx.receiptSequence.count({ where: { businessId, issuingReceiptId: receiptId, issuingUntil: { gt: now } } })) > 0,
  };
}
