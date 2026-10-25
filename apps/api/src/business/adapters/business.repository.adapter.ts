import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessRepositoryPort } from '@unna/domain';
import { Business, BusinessName, CUIT, Address, Schedule, BusinessSettings, Sucursal } from '@unna/domain';

@Injectable()
export class PrismaBusinessRepositoryAdapter implements BusinessRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  // Sucursales are upserted one by one and only removed ones are deleted: recreating them
  // would cascade or block on orders and receipts that reference a sucursal.
  async save(business: Business): Promise<void> {
    const { sucursales, ...props } = this.toPrisma(business);
    const keepIds = business.sucursales.map((s) => s.id);
    await this.prisma.$transaction([
      this.prisma.business.upsert({
        where: { id: business.id },
        create: props,
        update: props,
      }),
      this.prisma.sucursal.deleteMany({ where: { businessId: business.id, id: { notIn: keepIds } } }),
      ...sucursales.map((s: any) =>
        this.prisma.sucursal.upsert({
          where: { id: s.id },
          create: { ...s, businessId: business.id },
          update: s,
        }),
      ),
    ]);
  }

  async findById(id: string): Promise<Business | null> {
    const record = await this.prisma.business.findUnique({ 
      where: { id },
      include: { sucursales: true },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Business[]> {
    const records = await this.prisma.business.findMany({ 
      where: { ownerId },
      include: { sucursales: true },
    });
    return records.map(this.toDomain);
  }

  async existsByName(name: string): Promise<boolean> {
    const count = await this.prisma.business.count({ where: { name } });
    return count > 0;
  }

  async existsByCuit(cuit: string): Promise<boolean> {
    const count = await this.prisma.business.count({ where: { cuit } });
    return count > 0;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.business.delete({ where: { id } });
  }

  private toPrisma(business: Business): any {
    return {
      id: business.id,
      name: business.name.value,
      slug: business.slug,
      cuit: business.cuit.value,
      address: business.address,
      schedule: business.schedule,
      settings: business.settings,
      ownerId: business.ownerId,
      isActive: business.isActive,
      sucursales: business.sucursales.map(s => ({
          id: s.id,
          name: s.name,
          address: s.address,
          phone: s.phone,
          email: s.email,
          schedule: s.schedule,
          isMain: s.isMain,
          isActive: s.isActive,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  // Schedule is stored through its toJSON (week shape); older rows may hold the raw instance.
  private toSchedule(json: any): Schedule {
    return Schedule.create(json?.weekSchedule ?? json, json?.timezone);
  }

  private toDomain(record: any): Business {
    const sucursales = (record.sucursales || []).map((s: any) => 
      Sucursal.reconstitute({
        id: s.id,
        name: s.name,
        address: Address.create(s.address),
        phone: s.phone,
        email: s.email,
        schedule: this.toSchedule(s.schedule),
        isMain: s.isMain,
        isActive: s.isActive,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
      })
    );

    return Business.reconstitute(record.id, {
      name: BusinessName.create(record.name),
      cuit: CUIT.create(record.cuit),
      address: Address.create(record.address),
      schedule: this.toSchedule(record.schedule),
      settings: BusinessSettings.create(record.settings),
      ownerId: record.ownerId,
      slug: record.slug,
      isActive: record.isActive,
      sucursales,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }
}