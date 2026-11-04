import { Inject, Injectable } from '@nestjs/common';
import {
  MercadoPagoGatewayPort,
  MercadoPagoOrder,
  OnlineCheckoutRecord,
  OnlineCheckoutRepositoryPort,
  onlineCheckoutStatusFor,
  OnlineCheckoutUnitOfWorkPort,
} from '@unna/domain';
import { MercadoPagoAccessTokenProvider } from './mercadopago-access-token.provider';
import { placePaidOrder } from './online-checkout-order';
import { isOrderNumberCollision } from './sales.use-case';

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

/**
 * Brings an online checkout in line with its Mercado Pago order (S20), from the webhook, the
 * tracking page or the simulator. Only an order read from Mercado Pago counts. Mercado Pago is read
 * without any lock; the outcome is applied under the checkout lock to a checkout not paid yet, so
 * concurrent syncs of a paid order create exactly one order and one payment (unique orderId and
 * paymentId as second guard).
 */
@Injectable()
export class OnlineCheckoutSync {
  constructor(
    @Inject('OnlineCheckoutRepositoryPort') private readonly checkouts: OnlineCheckoutRepositoryPort,
    @Inject('OnlineCheckoutUnitOfWorkPort') private readonly unitOfWork: OnlineCheckoutUnitOfWorkPort,
    @Inject('MercadoPagoGatewayPort') private readonly gateway: MercadoPagoGatewayPort,
    private readonly tokens: MercadoPagoAccessTokenProvider,
  ) {}

  /**
   * Webhook and simulator: any checkout not paid yet is read, since a payment approved after the
   * checkout expired or failed still has to become an order. Null when no checkout has this Mercado
   * Pago order (Mercado Pago is not asked).
   */
  async syncByMpOrderId(mpOrderId: string, now = new Date()): Promise<OnlineCheckoutRecord | null> {
    const checkout = await this.checkouts.findByMpOrderId(mpOrderId);
    if (!checkout) return null;
    if (checkout.status === 'paid') return checkout;
    return this.apply(checkout, await this.readOrder(checkout, mpOrderId), now);
  }

  /** Tracking page: only a checkout awaiting payment is read; one without a Mercado Pago order just expires. */
  async refresh(checkout: OnlineCheckoutRecord, now = new Date()): Promise<OnlineCheckoutRecord> {
    if (checkout.status !== 'awaiting_payment') return checkout;
    if (!checkout.mpOrderId) return now >= checkout.expiresAt ? this.expire(checkout, now) : checkout;
    return this.apply(checkout, await this.readOrder(checkout, checkout.mpOrderId), now);
  }

  private async readOrder(checkout: OnlineCheckoutRecord, mpOrderId: string): Promise<MercadoPagoOrder> {
    const token = await this.tokens.validAccessToken(checkout.businessId);
    if (!token.ok) throw token.error ?? new Error('Conectá tu cuenta de Mercado Pago');
    return this.gateway.getOrder(token.value as string, mpOrderId);
  }

  private async apply(checkout: OnlineCheckoutRecord, mpOrder: MercadoPagoOrder, now: Date): Promise<OnlineCheckoutRecord> {
    const status = onlineCheckoutStatusFor(mpOrder.status, now >= checkout.expiresAt);
    if (mpOrder.id !== checkout.mpOrderId || !status) return checkout;

    for (let attempt = 1; ; attempt++) {
      try {
        return await this.unitOfWork.withCheckoutLock(checkout.id, async (repositories) => {
          const current = await repositories.checkouts.findById(checkout.id);
          if (!current || current.status === 'paid') return current ?? checkout;
          if (status === 'paid') return placePaidOrder(repositories, current, mpOrder, now);
          // Unpaid outcomes only move a checkout still awaiting payment.
          if (current.status !== 'awaiting_payment') return current;
          const updated = { ...current, status, updatedAt: now };
          await repositories.checkouts.update(updated);
          return updated;
        });
      } catch (error) {
        // The random order number was taken: the transaction is gone, so the whole step runs again.
        if (attempt >= MAX_ORDER_NUMBER_ATTEMPTS || !isOrderNumberCollision(error)) throw error;
      }
    }
  }

  private expire(checkout: OnlineCheckoutRecord, now: Date): Promise<OnlineCheckoutRecord> {
    return this.unitOfWork.withCheckoutLock(checkout.id, async ({ checkouts }) => {
      const current = await checkouts.findById(checkout.id);
      if (!current || current.status !== 'awaiting_payment') return current ?? checkout;
      const expired = { ...current, status: 'expired' as const, updatedAt: now };
      await checkouts.update(expired);
      return expired;
    });
  }
}
