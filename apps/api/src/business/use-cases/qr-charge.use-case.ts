import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CashSessionRepositoryPort,
  MercadoPagoConnectionRepositoryPort,
  MercadoPagoGatewayPort,
  MercadoPagoOrder,
  NotFoundError,
  OrderRepositoryPort,
  QR_CHARGE_EXPIRATION,
  QR_CHARGE_TTL_MS,
  qrChargeExternalReference,
  QrChargeRecord,
  QrChargeRepositoryPort,
  QrChargeUnitOfWorkPort,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { MercadoPagoAccessTokenProvider, MERCADOPAGO_NOT_CONNECTED } from './mercadopago-access-token.provider';
import { stableIdempotencyKey } from './mercadopago-idempotency-key';
import { pendingBalance, unpayableReason } from './order-payment';
import { QrChargeSync } from './qr-charge-sync';
import { QrChargeView, toQrChargeView } from './qr-charge.view';

const ORDER_NOT_FOUND = 'Pedido no encontrado';
const CHARGE_NOT_FOUND = 'Cobro QR no encontrado';
const POS_NOT_READY = 'Activá el cobro QR en esta sucursal';
const CASH_CLOSED = 'Abrí la caja para cobrar';
const ALREADY_PAID = 'El pedido ya está pagado';
const NO_QR = 'Mercado Pago no devolvió el QR del cobro';
const CANCEL_IN_PROGRESS = 'No se pudo cancelar el cobro QR: hay un pago en curso. Probá de nuevo en unos segundos';

const ok = <T>(value: T): UseCaseResult<T> => ({ ok: true, value });
const fail = <T>(message: string): UseCaseResult<T> => ({ ok: false, error: new Error(message) });
const notFound = <T>(message: string): UseCaseResult<T> => ({ ok: false, error: new NotFoundError(message) });

/**
 * "Cobrar con QR" in the POS (S15): a hybrid Mercado Pago QR order for the pending balance, payable
 * from the screen or the printed QR of the sucursal's POS. Reading and cancelling a charge sync it
 * with Mercado Pago (QrChargeSync), which registers the payment.
 */
@Injectable()
export class QrChargeUseCase {
  constructor(
    @Inject('OrderRepositoryPort') private readonly orders: OrderRepositoryPort,
    @Inject('CashSessionRepositoryPort') private readonly cashSessions: CashSessionRepositoryPort,
    @Inject('MercadoPagoConnectionRepositoryPort') private readonly mercadoPago: MercadoPagoConnectionRepositoryPort,
    @Inject('QrChargeRepositoryPort') private readonly charges: QrChargeRepositoryPort,
    @Inject('QrChargeUnitOfWorkPort') private readonly unitOfWork: QrChargeUnitOfWorkPort,
    @Inject('MercadoPagoGatewayPort') private readonly gateway: MercadoPagoGatewayPort,
    private readonly tokens: MercadoPagoAccessTokenProvider,
    private readonly sync: QrChargeSync,
  ) {}

  /** Returns the pending, unexpired charge of the order when there is one. */
  async create(businessId: string, orderId: string, now = new Date()): Promise<UseCaseResult<QrChargeView>> {
    const order = await this.orders.findByIdAndBusinessId(orderId, businessId);
    if (!order) return notFound(ORDER_NOT_FOUND);
    const unpayable = unpayableReason(order);
    if (unpayable) return fail(unpayable);
    if (!(await this.mercadoPago.findConnection(businessId))) return fail(MERCADOPAGO_NOT_CONNECTED);
    const posExternalId = (await this.mercadoPago.findSucursal(businessId, order.sucursalId))?.mpPosExternalId;
    if (!posExternalId) return fail(POS_NOT_READY);
    if (!(await this.cashSessions.findOpenBySucursal(businessId, order.sucursalId))) return fail(CASH_CLOSED);

    await this.settleExpired(businessId, orderId, now);
    const token = await this.tokens.validAccessToken(businessId);
    if (!token.ok) return { ok: false, error: token.error };

    // Under the order lock, so concurrent requests reuse one charge and the balance cannot change
    // until the charge is stored.
    return this.unitOfWork.withOrderLock(orderId, businessId, async ({ orders, payments, qrCharges }) => {
      const reusable = (await qrCharges.findPendingByOrder(businessId, orderId)).find((c) => c.expiresAt > now);
      if (reusable) return ok(toQrChargeView(reusable));

      const locked = await orders.findByIdAndBusinessId(orderId, businessId);
      if (!locked) return notFound<QrChargeView>(ORDER_NOT_FOUND);
      const reason = unpayableReason(locked);
      if (reason) return fail<QrChargeView>(reason);
      const amount = pendingBalance(locked, await payments.findByOrderId(orderId));
      if (amount <= 0) return fail<QrChargeView>(ALREADY_PAID);

      const id = randomUUID();
      const mpOrder = await this.gateway.createQrOrder(token.value as string, {
        externalReference: qrChargeExternalReference(orderId, id),
        externalPosId: posExternalId,
        amount,
        description: `Pedido ${locked.orderNumber}`,
        expirationTime: QR_CHARGE_EXPIRATION,
        idempotencyKey: id,
      });
      if (!mpOrder.qrData) return fail<QrChargeView>(NO_QR);

      const charge: QrChargeRecord = {
        id, businessId, orderId, sucursalId: locked.sucursalId, amount, status: 'pending', mpOrderId: mpOrder.id, mpPaymentId: null,
        qrData: mpOrder.qrData, expiresAt: new Date(now.getTime() + QR_CHARGE_TTL_MS), paidAt: null, paymentId: null, paymentError: null, createdAt: now,
      };
      await qrCharges.create(charge);
      return ok(toQrChargeView(charge));
    });
  }

  /** Syncs a pending charge with Mercado Pago; if it cannot be read, the stored charge is returned. */
  async get(businessId: string, chargeId: string, now = new Date()): Promise<UseCaseResult<QrChargeView>> {
    const charge = await this.charges.findById(businessId, chargeId);
    if (!charge) return notFound(CHARGE_NOT_FOUND);
    return ok(toQrChargeView(await this.sync.sync(charge, now).catch(() => charge)));
  }

  /**
   * Cancels the Mercado Pago order while it is unpaid (`created`). If the customer paid meanwhile,
   * the payment is registered and the charge comes back paid. Finished charges are returned as they are.
   */
  async cancel(businessId: string, chargeId: string, now = new Date()): Promise<UseCaseResult<QrChargeView>> {
    const charge = await this.charges.findById(businessId, chargeId);
    if (!charge) return notFound(CHARGE_NOT_FOUND);
    if (charge.status !== 'pending') return ok(toQrChargeView(charge));

    const token = await this.tokens.validAccessToken(businessId);
    if (!token.ok) return { ok: false, error: token.error };
    const accessToken = token.value as string;

    let mpOrder: MercadoPagoOrder = await this.gateway.getOrder(accessToken, charge.mpOrderId);
    if (mpOrder.status === 'created') {
      try {
        mpOrder = await this.gateway.cancelOrder(accessToken, charge.mpOrderId, stableIdempotencyKey(`qr-cancel:${charge.id}`));
      } catch {
        // Rejected (paid meanwhile, payment in progress...): what counts is the order as it is now.
        mpOrder = await this.gateway.getOrder(accessToken, charge.mpOrderId);
      }
    }
    const updated = await this.sync.apply(charge, mpOrder, now);
    return updated.status === 'pending' ? fail(CANCEL_IN_PROGRESS) : ok(toQrChargeView(updated));
  }

  /** Expired charges may have been paid at the last second: settle them before charging again. */
  private async settleExpired(businessId: string, orderId: string, now: Date): Promise<void> {
    for (const charge of await this.charges.findPendingByOrder(businessId, orderId)) {
      if (charge.expiresAt <= now) await this.sync.sync(charge, now).catch(() => charge);
    }
  }
}
