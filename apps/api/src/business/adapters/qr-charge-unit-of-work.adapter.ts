import { Injectable } from '@nestjs/common';
import { QrChargeLockedRepositories, QrChargeUnitOfWorkPort } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { lockOrder } from './sales.repository.adapter';
import { PrismaQrChargeRepositoryAdapter } from './qr-charge.repository.adapter';

// Creating a charge calls Mercado Pago while holding the order lock (timeout 15 s), so the
// transaction gets more than Prisma's 5 s default.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

/** The order lock of the sales unit of work, with the QR charges in the same transaction (S15). */
@Injectable()
export class PrismaQrChargeUnitOfWorkAdapter implements QrChargeUnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {}

  withOrderLock<T>(orderId: string, businessId: string, work: (repositories: QrChargeLockedRepositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const repositories = await lockOrder(tx, orderId, businessId);
      return work({ ...repositories, qrCharges: new PrismaQrChargeRepositoryAdapter(tx) });
    }, TRANSACTION_OPTIONS);
  }
}
