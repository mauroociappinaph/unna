import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  OnlineCheckoutLine,
  OnlineCheckoutRecord,
  OnlineCheckoutRepositoryPort,
  OnlineCheckoutStatus,
  OnlineCheckoutTracking,
  OrderStatus,
} from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';
import type { Db } from './sales.repository.adapter';

type OnlineCheckoutRow = Prisma.OnlineCheckoutGetPayload<object>;

const TRACKING_INCLUDE = {
  business: { select: { name: true } },
  order: { select: { orderNumber: true, status: true, updatedAt: true } },
} satisfies Prisma.OnlineCheckoutInclude;

/** Online checkouts of the pedido anticipado (S20) over the root client or, inside a unit of work, its transaction. */
@Injectable()
export class PrismaOnlineCheckoutRepositoryAdapter implements OnlineCheckoutRepositoryPort {
  constructor(@Inject(PrismaService) private readonly db: Db) {}

  async create(checkout: OnlineCheckoutRecord): Promise<void> {
    await this.db.onlineCheckout.create({ data: { ...checkout, lines: toJson(checkout.lines) } });
  }

  async findById(id: string): Promise<OnlineCheckoutRecord | null> {
    const row = await this.db.onlineCheckout.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async findByMpOrderId(mpOrderId: string): Promise<OnlineCheckoutRecord | null> {
    const row = await this.db.onlineCheckout.findUnique({ where: { mpOrderId } });
    return row ? toRecord(row) : null;
  }

  async findTrackingByTokenHash(trackingTokenHash: string): Promise<OnlineCheckoutTracking | null> {
    const row = await this.db.onlineCheckout.findUnique({ where: { trackingTokenHash }, include: TRACKING_INCLUDE });
    if (!row) return null;
    const { business, order, ...checkout } = row;
    return {
      checkout: toRecord(checkout),
      businessName: business.name,
      // Stored statuses were written from OrderStatus values.
      order: order ? { orderNumber: order.orderNumber, status: order.status as OrderStatus, updatedAt: order.updatedAt } : null,
    };
  }

  async attachMercadoPagoOrder(id: string, mpOrderId: string, checkoutUrl: string): Promise<void> {
    await this.db.onlineCheckout.updateMany({ where: { id, mpOrderId: null }, data: { mpOrderId, checkoutUrl } });
  }

  async update(checkout: OnlineCheckoutRecord): Promise<void> {
    const { status, paidAt, orderId, paymentId, mpPaymentId, paymentError } = checkout;
    await this.db.onlineCheckout.updateMany({ where: { id: checkout.id }, data: { status, paidAt, orderId, paymentId, mpPaymentId, paymentError } });
  }
}

/** Lines are plain JSON (ids, names, integers and modifier lists). */
const toJson = (lines: OnlineCheckoutLine[]): Prisma.InputJsonValue => lines as unknown as Prisma.InputJsonValue;

// Stored statuses and lines were written from OnlineCheckoutRecord values.
function toRecord(row: OnlineCheckoutRow): OnlineCheckoutRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    sucursalId: row.sucursalId,
    sucursalName: row.sucursalName,
    trackingTokenHash: row.trackingTokenHash,
    status: row.status as OnlineCheckoutStatus,
    customerName: row.customerName,
    lines: row.lines as unknown as OnlineCheckoutLine[],
    total: row.total,
    mpOrderId: row.mpOrderId,
    checkoutUrl: row.checkoutUrl,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
    orderId: row.orderId,
    paymentId: row.paymentId,
    mpPaymentId: row.mpPaymentId,
    paymentError: row.paymentError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
