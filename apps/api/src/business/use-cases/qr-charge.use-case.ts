import { Inject, Injectable } from '@nestjs/common';
import {
  CashSessionRepositoryPort,
  MercadoPagoConnectionRepositoryPort,
  MercadoPagoGatewayPort,
  MercadoPagoOrder,
  NotFoundError,
  OrderRepositoryPort,
  QR_CHARGE_EXPIRATION,
  qrChargeExternalReference,
  QrChargeRecord,
  QrChargeRepositoryPort,
  QrChargeUnitOfWorkPort,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { MercadoPagoAccessTokenProvider, MERCADOPAGO_NOT_CONNECTED } from './mercadopago-access-token.provider';
import { stableIdempotencyKey } from './mercadopago-idempotency-key';
import { unpayableReason } from './order-payment';
import { completeQrCharge, releaseQrCharge, reserveQrCharge } from './qr-charge-reservation';
import { QrChargeSync } from './qr-charge-sync';
import { QrChargeView, toQrChargeView } from './qr-charge.view';

const ORDER_NOT_FOUND = 'Pedido no encontrado';
const CHARGE_NOT_FOUND = 'Cobro QR no encontrado';
const POS_NOT_READY = 'Activá el cobro QR en esta sucursal';
const CASH_CLOSED = 'Abrí la caja para cobrar';
const NO_QR = 'Mercado Pago no devolvió el QR del cobro';
const CANCEL_IN_PROGRESS = 'No se pudo cancelar el cobro QR: hay un pago en curso. Probá de nuevo en unos segundos';
const RESERVATION_BUSY = 'Ya se está creando el cobro QR de este pedido. Probá de nuevo en unos segundos';
const RESERVATION_LOST = 'No se pudo crear el cobro QR. Probá de nuevo';

/** A concurrent create waits this long for the request that reserved the charge (Mercado Pago times out at 15 s). */
const RESERVATION_WAIT_MS = 20_000;
const RESERVATION_POLL_MS = 200;

const ok = <T>(value: T): UseCaseResult<T> => ({ ok: true, value });
const fail = <T>(message: string): UseCaseResult<T> => ({ ok: false, error: new Error(message) });
const notFound = <T>(message: string): UseCaseResult<T> => ({ ok: false, error: new NotFoundError(message) });

/**
 * "Cobrar con QR" in the POS (S15): a hybrid Mercado Pago QR order for the pending balance, payable
 * from the screen or the printed QR of the sucursal's POS. Reading and cancelling a charge sync it
 * with Mercado Pago (QrChargeSync), which registers the payment.
 *
 * Mercado Pago is never called with the order lock held (S18), so payments and status changes of
 * the order never wait for it: create reserves the charge in a short lock (`creating`), calls
 * Mercado Pago without locks and stores its order in a second short lock. Concurrent creates wait
 * for the reservation and get the same charge, so an order never has two Mercado Pago orders.
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

    const accessToken = token.value as string;

    const deadline = Date.now() + RESERVATION_WAIT_MS;
    for (;;) {
      const reservation = await this.unitOfWork.withOrderLock(orderId, businessId, (locked) => reserveQrCharge(locked, businessId, orderId, now));
      if (reservation.kind === 'ready') return ok(toQrChargeView(reservation.charge));
      if (reservation.kind === 'rejected') return reservation.result;
      if (reservation.kind === 'reserved') {
        return this.createMercadoPagoOrder(accessToken, posExternalId, reservation.charge, reservation.orderNumber, now);
      }
      if (!(await this.reservationFinished(businessId, reservation.chargeId, deadline))) return fail(RESERVATION_BUSY);
    }
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
    const { mpOrderId } = charge;
    if (charge.status !== 'pending' || !mpOrderId) return ok(toQrChargeView(charge));

    const token = await this.tokens.validAccessToken(businessId);
    if (!token.ok) return { ok: false, error: token.error };
    const accessToken = token.value as string;

    let mpOrder: MercadoPagoOrder = await this.gateway.getOrder(accessToken, mpOrderId);
    if (mpOrder.status === 'created') {
      try {
        mpOrder = await this.gateway.cancelOrder(accessToken, mpOrderId, stableIdempotencyKey(`qr-cancel:${charge.id}`));
      } catch {
        // Rejected (paid meanwhile, payment in progress...): what counts is the order as it is now.
        mpOrder = await this.gateway.getOrder(accessToken, mpOrderId);
      }
    }
    const updated = await this.sync.apply(charge, mpOrder, now);
    return updated.status === 'pending' ? fail(CANCEL_IN_PROGRESS) : ok(toQrChargeView(updated));
  }

  /**
   * Step 2 of create (S18), without any lock: the Mercado Pago order with the charge id as
   * idempotency key. Its outcome is stored, or the reservation released, in a short order lock.
   */
  private async createMercadoPagoOrder(
    accessToken: string,
    externalPosId: string,
    reserved: QrChargeRecord,
    orderNumber: string,
    now: Date,
  ): Promise<UseCaseResult<QrChargeView>> {
    const { id, businessId, orderId } = reserved;
    let mpOrder: MercadoPagoOrder;
    try {
      mpOrder = await this.gateway.createQrOrder(accessToken, {
        externalReference: qrChargeExternalReference(orderId, id),
        externalPosId,
        amount: reserved.amount,
        description: `Pedido ${orderNumber}`,
        expirationTime: QR_CHARGE_EXPIRATION,
        idempotencyKey: id,
      });
    } catch (error) {
      await this.release(reserved);
      throw error;
    }
    const { qrData } = mpOrder;
    if (!qrData) {
      await this.release(reserved);
      return fail(NO_QR);
    }

    const stored = await this.unitOfWork.withOrderLock(orderId, businessId, (locked) => completeQrCharge(locked, reserved, { id: mpOrder.id, qrData }, now));
    if (stored) return ok(toQrChargeView(stored));
    // Taken over as abandoned meanwhile: nobody shows this QR, so its order must not stay payable.
    await this.gateway.cancelOrder(accessToken, mpOrder.id, stableIdempotencyKey(`qr-cancel:${id}`)).catch(() => undefined);
    return fail(RESERVATION_LOST);
  }

  /**
   * Best effort: when the release itself fails, the reservation stays `creating` and is taken over
   * once stale, so the Mercado Pago error is the one reported.
   */
  private async release(reserved: QrChargeRecord): Promise<void> {
    await this.unitOfWork
      .withOrderLock(reserved.orderId, reserved.businessId, (locked) => releaseQrCharge(locked, reserved))
      .catch(() => undefined);
  }

  /** Polls, without locks, until the reservation of another request is no longer `creating`; false at the deadline. */
  private async reservationFinished(businessId: string, chargeId: string, deadline: number): Promise<boolean> {
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, RESERVATION_POLL_MS));
      if ((await this.charges.findById(businessId, chargeId))?.status !== 'creating') return true;
    }
    return false;
  }

  /** Expired charges may have been paid at the last second: settle them before charging again. */
  private async settleExpired(businessId: string, orderId: string, now: Date): Promise<void> {
    for (const charge of await this.charges.findPendingByOrder(businessId, orderId)) {
      if (charge.expiresAt <= now) await this.sync.sync(charge, now).catch(() => charge);
    }
  }
}
