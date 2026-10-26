import { Injectable } from '@nestjs/common';
import { OnlineCheckoutLockedRepositories, OnlineCheckoutUnitOfWorkPort } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { orderRepositoriesIn } from './sales.repository.adapter';
import { PrismaOnlineCheckoutRepositoryAdapter } from './online-checkout.repository.adapter';

/**
 * Locks the online checkout row (S20) and binds the order, payment, cash session and checkout
 * repositories to the same transaction: the order, its payment and the paid checkout commit together.
 * The order is new, so no order lock is needed. Mercado Pago is never called inside (S18), so
 * Prisma's default transaction timeout is enough.
 */
@Injectable()
export class PrismaOnlineCheckoutUnitOfWorkAdapter implements OnlineCheckoutUnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {}

  withCheckoutLock<T>(checkoutId: string, work: (repositories: OnlineCheckoutLockedRepositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM online_checkouts WHERE id = ${checkoutId} FOR UPDATE`;
      return work({ ...orderRepositoriesIn(tx), checkouts: new PrismaOnlineCheckoutRepositoryAdapter(tx) });
    });
  }
}
