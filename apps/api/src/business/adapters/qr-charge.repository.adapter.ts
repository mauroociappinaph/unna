import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QrChargeRecord, QrChargeRepositoryPort, QrChargeStatus } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';
import type { Db } from './sales.repository.adapter';

type QrChargeRow = Prisma.QrChargeGetPayload<object>;

/** QR charges (S15) over the root client or, inside a unit of work, its transaction. */
@Injectable()
export class PrismaQrChargeRepositoryAdapter implements QrChargeRepositoryPort {
  constructor(@Inject(PrismaService) private readonly db: Db) {}

  async findById(businessId: string, id: string): Promise<QrChargeRecord | null> {
    const row = await this.db.qrCharge.findFirst({ where: { id, businessId } });
    return row ? toRecord(row) : null;
  }

  async findByMpOrderId(mpOrderId: string): Promise<QrChargeRecord | null> {
    const row = await this.db.qrCharge.findUnique({ where: { mpOrderId } });
    return row ? toRecord(row) : null;
  }

  async findPendingByOrder(businessId: string, orderId: string): Promise<QrChargeRecord[]> {
    const rows = await this.db.qrCharge.findMany({ where: { businessId, orderId, status: 'pending' }, orderBy: { createdAt: 'asc' } });
    return rows.map(toRecord);
  }

  async create(charge: QrChargeRecord): Promise<void> {
    await this.db.qrCharge.create({ data: charge });
  }

  async update(charge: QrChargeRecord): Promise<void> {
    const { status, mpPaymentId, paidAt, paymentId, paymentError } = charge;
    await this.db.qrCharge.updateMany({
      where: { id: charge.id, businessId: charge.businessId },
      data: { status, mpPaymentId, paidAt, paymentId, paymentError },
    });
  }
}

// Stored statuses were written from QrChargeStatus values.
function toRecord(row: QrChargeRow): QrChargeRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    orderId: row.orderId,
    sucursalId: row.sucursalId,
    amount: row.amount,
    status: row.status as QrChargeStatus,
    mpOrderId: row.mpOrderId,
    mpPaymentId: row.mpPaymentId,
    qrData: row.qrData,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
    paymentId: row.paymentId,
    paymentError: row.paymentError,
    createdAt: row.createdAt,
  };
}
