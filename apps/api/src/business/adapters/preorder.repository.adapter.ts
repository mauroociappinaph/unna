import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PreorderLocal, PreorderRepositoryPort, PreorderSucursal } from '@unna/domain';
import { PrismaService } from '../../prisma/prisma.service';
import { scheduleFromJson } from './business.repository.adapter';

const SUCURSAL_FIELDS = { id: true, businessId: true, name: true, isActive: true, preorderEnabled: true, preorderSlug: true } as const;

type SucursalRow = Prisma.SucursalGetPayload<{ select: typeof SUCURSAL_FIELDS }>;

/** Pedido anticipado settings of the sucursales (S20). */
@Injectable()
export class PrismaPreorderRepositoryAdapter implements PreorderRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listSucursales(businessId: string): Promise<PreorderSucursal[]> {
    const rows = await this.prisma.sucursal.findMany({ where: { businessId }, select: SUCURSAL_FIELDS, orderBy: { createdAt: 'asc' } });
    return rows.map(toSucursal);
  }

  async findSucursal(businessId: string, sucursalId: string): Promise<PreorderSucursal | null> {
    const row = await this.prisma.sucursal.findFirst({ where: { id: sucursalId, businessId }, select: SUCURSAL_FIELDS });
    return row ? toSucursal(row) : null;
  }

  async findEnabledBySlug(slug: string): Promise<PreorderLocal | null> {
    const row = await this.prisma.sucursal.findFirst({
      where: { preorderSlug: slug, preorderEnabled: true },
      select: { ...SUCURSAL_FIELDS, schedule: true, business: { select: { name: true, isActive: true } } },
    });
    if (!row) return null;
    return { ...toSucursal(row), businessName: row.business.name, businessActive: row.business.isActive, schedule: scheduleFromJson(row.schedule) };
  }

  async enable(businessId: string, sucursalId: string, candidateSlug: string): Promise<string | null> {
    await this.prisma.$transaction([
      this.prisma.sucursal.updateMany({ where: { id: sucursalId, businessId, preorderSlug: null }, data: { preorderSlug: candidateSlug } }),
      this.prisma.sucursal.updateMany({ where: { id: sucursalId, businessId }, data: { preorderEnabled: true } }),
    ]);
    const row = await this.prisma.sucursal.findFirst({ where: { id: sucursalId, businessId }, select: { preorderSlug: true } });
    return row?.preorderSlug ?? null;
  }

  async disable(businessId: string, sucursalId: string): Promise<void> {
    await this.prisma.sucursal.updateMany({ where: { id: sucursalId, businessId }, data: { preorderEnabled: false } });
  }
}

function toSucursal(row: SucursalRow): PreorderSucursal {
  return { id: row.id, businessId: row.businessId, name: row.name, isActive: row.isActive, enabled: row.preorderEnabled, slug: row.preorderSlug };
}
