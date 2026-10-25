import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessRepositoryPort, WeekSchedule } from '@unna/domain';
import { Business, BusinessName, CUIT, Address, Schedule, BusinessSettings, Sucursal } from '@unna/domain';

type BusinessRecord = Prisma.BusinessGetPayload<{ include: { sucursales: true } }>;
type AddressJson = Parameters<typeof Address.create>[0];
type SettingsJson = Parameters<typeof BusinessSettings.create>[0];
/** Week shape written by Schedule.toJSON, or the raw Schedule instance held by older rows. */
type ScheduleJson = Partial<WeekSchedule> & { weekSchedule?: Partial<WeekSchedule>; timezone?: string };

/**
 * Json columns hold the fields this adapter wrote from a value object; Prisma only types them as
 * JsonValue, so the stored shape is asserted here, once, and validated by the value object's create.
 */
const storedAs = <T>(json: Prisma.JsonValue): T => json as unknown as T;

const scheduleJson = (schedule: Schedule): Prisma.InputJsonObject =>
  Object.fromEntries(Object.entries(schedule.toJSON()).map(([day, hours]) => [day, { ...hours }]));

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
      ...sucursales.map((s) =>
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
    return records.map((r) => this.toDomain(r));
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

  // Value objects are stored as Prisma serializes them: own fields, or toJSON for Schedule.
  private toPrisma(business: Business) {
    return {
      id: business.id,
      name: business.name.value,
      slug: business.slug,
      cuit: business.cuit.value,
      address: { ...business.address },
      schedule: scheduleJson(business.schedule),
      settings: { ...business.settings },
      ownerId: business.ownerId,
      isActive: business.isActive,
      sucursales: business.sucursales.map(s => ({
          id: s.id,
          name: s.name,
          address: { ...s.address },
          phone: s.phone,
          email: s.email,
          schedule: scheduleJson(s.schedule),
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
  private toSchedule(json: Prisma.JsonValue): Schedule {
    const stored = json as ScheduleJson;
    return Schedule.create(stored?.weekSchedule ?? stored, stored?.timezone);
  }

  private toDomain(record: BusinessRecord): Business {
    const sucursales = (record.sucursales || []).map((s) => 
      Sucursal.reconstitute({
        id: s.id,
        name: s.name,
        address: Address.create(storedAs<AddressJson>(s.address)),
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
      address: Address.create(storedAs<AddressJson>(record.address)),
      schedule: this.toSchedule(record.schedule),
      settings: BusinessSettings.create(storedAs<SettingsJson>(record.settings)),
      ownerId: record.ownerId,
      slug: record.slug,
      isActive: record.isActive,
      sucursales,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }
}