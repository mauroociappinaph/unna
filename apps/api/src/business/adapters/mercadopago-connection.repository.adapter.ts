import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  MercadoPagoConnectionRecord,
  MercadoPagoConnectionRepositoryPort,
  MercadoPagoOAuthAttempt,
  MercadoPagoPosLink,
  MercadoPagoSucursal,
  MercadoPagoTokenUpdate,
} from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';

const SUCURSAL_FIELDS = {
  id: true, businessId: true, name: true, address: true,
  mpStoreId: true, mpPosId: true, mpPosExternalId: true, qrImageUrl: true, qrTemplateUrl: true,
} as const;
const NO_MERCADOPAGO_LINKS = { mpStoreId: null, mpPosId: null, mpPosExternalId: null, qrImageUrl: null, qrTemplateUrl: null };

type SucursalRow = Prisma.SucursalGetPayload<{ select: typeof SUCURSAL_FIELDS }>;

/** Mercado Pago connection, OAuth attempts and sucursal links (S15). Secret columns hold ciphertext. */
@Injectable()
export class PrismaMercadoPagoConnectionRepositoryAdapter implements MercadoPagoConnectionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findConnection(businessId: string): Promise<MercadoPagoConnectionRecord | null> {
    const row = await this.prisma.mercadoPagoConnection.findUnique({ where: { businessId } });
    if (!row) return null;
    return {
      businessId: row.businessId,
      mpUserId: row.mpUserId,
      liveMode: row.liveMode,
      scope: row.scope,
      encryptedAccessToken: row.encryptedAccessToken,
      encryptedRefreshToken: row.encryptedRefreshToken,
      accessTokenExpiresAt: row.accessTokenExpiresAt,
      connectedAt: row.connectedAt,
    };
  }

  async saveConnection(connection: MercadoPagoConnectionRecord): Promise<void> {
    const { businessId, ...data } = connection;
    await this.prisma.$transaction(async (tx) => {
      const previous = await tx.mercadoPagoConnection.findUnique({ where: { businessId }, select: { mpUserId: true } });
      if (previous && previous.mpUserId !== connection.mpUserId) {
        await tx.sucursal.updateMany({ where: { businessId }, data: NO_MERCADOPAGO_LINKS });
      }
      await tx.mercadoPagoConnection.upsert({ where: { businessId }, create: connection, update: data });
    });
  }

  async updateTokens(businessId: string, tokens: MercadoPagoTokenUpdate): Promise<void> {
    await this.prisma.mercadoPagoConnection.updateMany({ where: { businessId }, data: tokens });
  }

  async deleteConnection(businessId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.mercadoPagoConnection.deleteMany({ where: { businessId } }),
      this.prisma.sucursal.updateMany({ where: { businessId }, data: NO_MERCADOPAGO_LINKS }),
    ]);
  }

  async saveOAuthAttempt(attempt: MercadoPagoOAuthAttempt): Promise<void> {
    await this.prisma.mercadoPagoOAuthAttempt.create({ data: attempt });
  }

  /** Concurrent callbacks with the same state: only the one whose delete removes the row wins. */
  consumeOAuthAttempt(stateHash: string): Promise<MercadoPagoOAuthAttempt | null> {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.mercadoPagoOAuthAttempt.findUnique({
        where: { stateHash },
        select: { stateHash: true, businessId: true, ownerId: true, encryptedCodeVerifier: true, expiresAt: true },
      });
      if (!attempt) return null;
      const { count } = await tx.mercadoPagoOAuthAttempt.deleteMany({ where: { stateHash } });
      return count === 1 ? attempt : null;
    });
  }

  async deleteExpiredOAuthAttempts(now: Date): Promise<void> {
    await this.prisma.mercadoPagoOAuthAttempt.deleteMany({ where: { expiresAt: { lte: now } } });
  }

  async findBusinessOwnerId(businessId: string): Promise<string | null> {
    const business = await this.prisma.business.findUnique({ where: { id: businessId }, select: { ownerId: true } });
    return business?.ownerId ?? null;
  }

  async listSucursales(businessId: string): Promise<MercadoPagoSucursal[]> {
    const rows = await this.prisma.sucursal.findMany({ where: { businessId }, select: SUCURSAL_FIELDS, orderBy: { createdAt: 'asc' } });
    return rows.map(toSucursal);
  }

  async findSucursal(businessId: string, sucursalId: string): Promise<MercadoPagoSucursal | null> {
    const row = await this.prisma.sucursal.findFirst({ where: { id: sucursalId, businessId }, select: SUCURSAL_FIELDS });
    return row ? toSucursal(row) : null;
  }

  async saveSucursalStore(businessId: string, sucursalId: string, mpStoreId: string): Promise<void> {
    await this.prisma.sucursal.updateMany({ where: { id: sucursalId, businessId }, data: { mpStoreId } });
  }

  async saveSucursalPos(businessId: string, sucursalId: string, pos: MercadoPagoPosLink): Promise<void> {
    await this.prisma.sucursal.updateMany({ where: { id: sucursalId, businessId }, data: pos });
  }
}

function toSucursal(row: SucursalRow): MercadoPagoSucursal {
  const address = (row.address ?? {}) as Record<string, unknown>;
  const text = (key: string) => (typeof address[key] === 'string' ? (address[key] as string) : '');
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    address: { street: text('street'), number: text('number'), city: text('city'), province: text('province'), neighborhood: text('neighborhood') || undefined },
    mpStoreId: row.mpStoreId,
    mpPosId: row.mpPosId,
    mpPosExternalId: row.mpPosExternalId,
    qrImageUrl: row.qrImageUrl,
    qrTemplateUrl: row.qrTemplateUrl,
  };
}
