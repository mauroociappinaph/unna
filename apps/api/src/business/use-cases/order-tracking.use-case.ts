import { Inject, Injectable } from '@nestjs/common';
import {
  estimatedPreparationMinutes,
  isWellFormedTrackingToken,
  NotFoundError,
  OnlineCheckoutRepositoryPort,
  OnlineCheckoutTracking,
  preorderTrackingStatus,
  PreorderTrackingStatus,
  publicCustomerName,
  shortOrderNumber,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { hashTrackingToken } from './online-checkout.use-case';
import { OnlineCheckoutSync } from './online-checkout-sync';

const NOT_FOUND = 'Pedido no encontrado';
const ESTIMATED_STATUSES: readonly PreorderTrackingStatus[] = ['received', 'preparing'];

export interface PreorderTrackingView {
  status: PreorderTrackingStatus;
  /** Short number the bar calls (last 3 characters), once the order exists. */
  orderNumber: string | null;
  businessName: string;
  customerFirstName: string | null;
  sucursalName: string;
  /** Integer cents. */
  total: number;
  items: Array<{ name: string; quantity: number }>;
  estimatedMinutes: number | null;
  updatedAt: string;
}

/**
 * Tracking page of a pedido anticipado (S20). The secret token in the URL is the only credential;
 * unknown and malformed tokens answer the same 404. It shows only this checkout: short order number,
 * first name, sucursal, status, total, item names and quantities, and the estimate. While awaiting
 * payment it syncs with Mercado Pago; if Mercado Pago cannot be read, the stored status is shown.
 */
@Injectable()
export class OrderTrackingUseCase {
  constructor(
    @Inject('OnlineCheckoutRepositoryPort') private readonly checkouts: Pick<OnlineCheckoutRepositoryPort, 'findTrackingByTokenHash'>,
    private readonly sync: OnlineCheckoutSync,
  ) {}

  async track(trackingToken: string, now = new Date()): Promise<UseCaseResult<PreorderTrackingView>> {
    if (!isWellFormedTrackingToken(trackingToken)) return { ok: false, error: new NotFoundError(NOT_FOUND) };
    const hash = hashTrackingToken(trackingToken);
    let tracking = await this.checkouts.findTrackingByTokenHash(hash);
    if (!tracking) return { ok: false, error: new NotFoundError(NOT_FOUND) };

    if (tracking.checkout.status === 'awaiting_payment') {
      const synced = await this.sync.refresh(tracking.checkout, now).catch(() => tracking!.checkout);
      if (synced.status !== 'awaiting_payment') tracking = (await this.checkouts.findTrackingByTokenHash(hash)) ?? tracking;
    }
    return { ok: true, value: toView(tracking) };
  }
}

function toView({ checkout, businessName, order }: OnlineCheckoutTracking): PreorderTrackingView {
  const status = preorderTrackingStatus(checkout.status, order?.status ?? null);
  const updatedAt = order && order.updatedAt > checkout.updatedAt ? order.updatedAt : checkout.updatedAt;
  return {
    status,
    orderNumber: order ? shortOrderNumber(order.orderNumber) : null,
    businessName,
    customerFirstName: publicCustomerName(checkout.customerName),
    sucursalName: checkout.sucursalName,
    total: checkout.total,
    items: checkout.lines.map((line) => ({ name: line.productName, quantity: line.quantity })),
    estimatedMinutes: ESTIMATED_STATUSES.includes(status) ? estimatedPreparationMinutes(checkout.lines) : null,
    updatedAt: updatedAt.toISOString(),
  };
}
