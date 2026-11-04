import { Injectable } from '@nestjs/common';
import { QrChargeLockedRepositories, QrChargeUnitOfWorkPort } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { lockOrder } from './sales.repository.adapter';
import { PrismaQrChargeRepositoryAdapter } from './qr-charge.repository.adapter';

/**
 * The order lock of the sales unit of work, with the QR charges in the same transaction (S15).
 * Mercado Pago is never called inside (S18), so Prisma's default transaction timeout is enough.
 */
@Injectable()
export class PrismaQrChargeUnitOfWorkAdapter implements QrChargeUnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {}

  withOrderLock<T>(orderId: string, businessId: string, work: (repositories: QrChargeLockedRepositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const repositories = await lockOrder(tx, orderId, businessId);
      return work({ ...repositories, qrCharges: new PrismaQrChargeRepositoryAdapter(tx) });
    });
  }
}
