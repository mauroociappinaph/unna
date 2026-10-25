import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PriceListRepositoryPort, PriceList, PriceListEntry } from '@unna/domain';
import { money } from './catalog.mappers';

type PriceListRecord = Prisma.PriceListGetPayload<{ include: { entries: true } }>;

@Injectable()
export class PrismaPriceListRepositoryAdapter implements PriceListRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(list: PriceList): Promise<void> {
    const data = {
      businessId: list.businessId,
      name: list.name,
      description: list.description,
      type: list.type,
      isDefault: list.isDefault,
      isActive: list.isActive,
      validFrom: list.validFrom ?? null,
      validTo: list.validTo ?? null,
      validDays: list.validDays ?? [],
      validFromTime: list.validFromTime ?? null,
      validToTime: list.validToTime ?? null,
    };
    await this.prisma.$transaction([
      this.prisma.priceList.upsert({
        where: { id: list.id },
        create: { id: list.id, ...data, createdAt: list.createdAt },
        update: data,
      }),
      this.prisma.priceListEntry.deleteMany({ where: { priceListId: list.id } }),
      this.prisma.priceListEntry.createMany({
        data: list.entries.map((e) => ({
          priceListId: list.id,
          productId: e.productId,
          price: e.price.toCents(),
          costPrice: e.costPrice?.toCents() ?? null,
          isActive: e.isActive,
        })),
      }),
    ]);
  }

  async findById(id: string): Promise<PriceList | null> {
    const record = await this.prisma.priceList.findUnique({ where: { id }, include: { entries: true } });
    return record ? this.toDomain(record) : null;
  }

  async findByBusinessId(businessId: string): Promise<PriceList[]> {
    const records = await this.prisma.priceList.findMany({
      where: { businessId },
      include: { entries: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findActiveByBusinessId(businessId: string): Promise<PriceList[]> {
    const records = await this.prisma.priceList.findMany({
      where: { businessId, isActive: true },
      include: { entries: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findDefaultByBusinessId(businessId: string): Promise<PriceList | null> {
    const record = await this.prisma.priceList.findFirst({
      where: { businessId, isDefault: true, isActive: true },
      include: { entries: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findValidAt(businessId: string, date: Date, time?: string): Promise<PriceList[]> {
    const lists = await this.findActiveByBusinessId(businessId);
    return lists.filter((l) => l.isValidAt(date, time));
  }

  async findByIdAndBusinessId(id: string, businessId: string): Promise<PriceList | null> {
    const record = await this.prisma.priceList.findFirst({ where: { id, businessId }, include: { entries: true } });
    return record ? this.toDomain(record) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.priceList.delete({ where: { id } });
  }

  private toDomain(r: PriceListRecord): PriceList {
    return PriceList.reconstitute({
      id: r.id,
      businessId: r.businessId,
      name: r.name,
      description: r.description ?? undefined,
      type: r.type as PriceList['type'],
      isDefault: r.isDefault,
      isActive: r.isActive,
      validFrom: r.validFrom ?? undefined,
      validTo: r.validTo ?? undefined,
      validDays: r.validDays?.length ? r.validDays : undefined,
      validFromTime: r.validFromTime ?? undefined,
      validToTime: r.validToTime ?? undefined,
      entries: (r.entries ?? []).map((e) =>
        PriceListEntry.reconstitute({
          productId: e.productId,
          price: money(e.price),
          costPrice: e.costPrice != null ? money(e.costPrice) : undefined,
          isActive: e.isActive,
        }),
      ),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
