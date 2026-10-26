import { Inject, Injectable } from '@nestjs/common';
import {
  MercadoPagoGatewayPort,
  MercadoPagoOrder,
  QrChargeLockedRepositories,
  QrChargeRecord,
  QrChargeRepositoryPort,
  qrChargeStatusFor,
  QrChargeUnitOfWorkPort,
} from '@unna/domain';
import { MercadoPagoAccessTokenProvider } from './mercadopago-access-token.provider';
import { registerOrderPayment } from './order-payment';

const AMOUNT_MISMATCH = 'El monto cobrado en Mercado Pago no coincide con el cobro QR';

/**
 * Brings a QR charge in line with its Mercado Pago order (S15), from the POS polling, a cancel, the
 * webhook or the simulator. Only an order read from Mercado Pago counts, never a notification body.
 * Mercado Pago is read without any lock; each outcome is applied under the order lock and only to a
 * charge still pending, so concurrent syncs of a paid order register exactly one payment. A charge
 * still `creating` has no Mercado Pago order yet and is returned as it is (S18).
 */
@Injectable()
export class QrChargeSync {
  constructor(
    @Inject('QrChargeRepositoryPort') private readonly charges: QrChargeRepositoryPort,
    @Inject('QrChargeUnitOfWorkPort') private readonly unitOfWork: QrChargeUnitOfWorkPort,
    @Inject('MercadoPagoGatewayPort') private readonly gateway: MercadoPagoGatewayPort,
    private readonly tokens: MercadoPagoAccessTokenProvider,
  ) {}

  /** Null when no charge has this Mercado Pago order (Mercado Pago is not asked). */
  async syncByMpOrderId(mpOrderId: string, now = new Date()): Promise<QrChargeRecord | null> {
    const charge = await this.charges.findByMpOrderId(mpOrderId);
    return charge ? this.sync(charge, now) : null;
  }

  /** Reads the order with the connection of the charge's business; finished charges are returned as they are. */
  async sync(charge: QrChargeRecord, now = new Date()): Promise<QrChargeRecord> {
    if (charge.status !== 'pending' || !charge.mpOrderId) return charge;
    return this.apply(charge, await this.readOrder(charge.businessId, charge.mpOrderId), now);
  }

  private async readOrder(businessId: string, mpOrderId: string): Promise<MercadoPagoOrder> {
    const token = await this.tokens.validAccessToken(businessId);
    if (!token.ok) throw token.error ?? new Error('Conectá tu cuenta de Mercado Pago');
    return this.gateway.getOrder(token.value as string, mpOrderId);
  }

  /** Applies an order read from Mercado Pago to the charge; a status that is not final keeps it pending. */
  async apply(charge: QrChargeRecord, mpOrder: MercadoPagoOrder, now = new Date()): Promise<QrChargeRecord> {
    const status = qrChargeStatusFor(mpOrder.status);
    if (!charge.mpOrderId || mpOrder.id !== charge.mpOrderId || !status) return charge;

    return this.unitOfWork.withOrderLock(charge.orderId, charge.businessId, async (repositories) => {
      const current = await repositories.qrCharges.findById(charge.businessId, charge.id);
      if (!current || current.status !== 'pending') return current ?? charge;
      const updated = status === 'paid' ? await this.paid(repositories, current, mpOrder, now) : { ...current, status };
      await repositories.qrCharges.update(updated);
      return updated;
    });
  }

  /**
   * The money is already in the seller's account: when the payment cannot be registered (caja
   * closed, balance exceeded, order cancelled...) the charge is still paid, without payment and
   * with the reason, so the owner can register or refund it by hand.
   */
  private async paid(repositories: QrChargeLockedRepositories, charge: QrChargeRecord, mpOrder: MercadoPagoOrder, now: Date): Promise<QrChargeRecord> {
    // Only reached from apply, which needs the Mercado Pago order id of the charge.
    const reference = mpOrder.id;
    const paid: QrChargeRecord = { ...charge, status: 'paid', paidAt: now, mpPaymentId: mpOrder.paymentId };
    if (mpOrder.totalAmount !== charge.amount) return { ...paid, paymentError: AMOUNT_MISMATCH };

    const registered = await registerOrderPayment(repositories, {
      businessId: charge.businessId,
      orderId: charge.orderId,
      amount: charge.amount,
      method: 'mercado_pago',
      reference,
    });
    if (!registered.ok) return { ...paid, paymentError: registered.error?.message ?? 'No se pudo registrar el pago' };
    return { ...paid, paymentId: registered.value!.payment.id, paymentError: null };
  }
}
