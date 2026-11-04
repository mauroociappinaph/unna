import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ModifierGroupRepositoryPort, ModifierGroup, ModifierOption } from '@unna/domain';

type ModifierGroupRecord = Prisma.ModifierGroupGetPayload<{ include: { options: true } }>;

@Injectable()
export class PrismaModifierGroupRepositoryAdapter implements ModifierGroupRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(group: ModifierGroup): Promise<void> {
    const data = {
      businessId: group.businessId,
      name: group.name,
      description: group.description,
      minSelection: group.minSelection,
      maxSelection: group.maxSelection,
      isRequired: group.isRequired,
      displayOrder: group.displayOrder,
      isActive: group.isActive,
    };
    await this.prisma.$transaction([
      this.prisma.modifierGroup.upsert({
        where: { id: group.id },
        create: { id: group.id, ...data, createdAt: group.createdAt },
        update: data,
      }),
      this.prisma.modifierOption.deleteMany({ where: { modifierGroupId: group.id } }),
      this.prisma.modifierOption.createMany({
        data: group.options.map((o) => ({
          id: o.id,
          modifierGroupId: group.id,
          name: o.name,
          priceDelta: o.priceDelta,
          isDefault: o.isDefault,
          displayOrder: o.displayOrder,
          isActive: o.isActive,
        })),
      }),
    ]);
  }

  async findById(id: string): Promise<ModifierGroup | null> {
    const record = await this.prisma.modifierGroup.findUnique({
      where: { id },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
    return record ? this.toDomain(record) : null;
  }

  async findByBusinessId(businessId: string): Promise<ModifierGroup[]> {
    const records = await this.prisma.modifierGroup.findMany({
      where: { businessId },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { displayOrder: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findActiveByBusinessId(businessId: string): Promise<ModifierGroup[]> {
    const records = await this.prisma.modifierGroup.findMany({
      where: { businessId, isActive: true },
      include: { options: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } } },
      orderBy: { displayOrder: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByIdAndBusinessId(id: string, businessId: string): Promise<ModifierGroup | null> {
    const record = await this.prisma.modifierGroup.findFirst({
      where: { id, businessId },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });
    return record ? this.toDomain(record) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.modifierGroup.delete({ where: { id } });
  }

  private toDomain(r: ModifierGroupRecord): ModifierGroup {
    return ModifierGroup.reconstitute({
      id: r.id,
      businessId: r.businessId,
      name: r.name,
      description: r.description ?? undefined,
      minSelection: r.minSelection,
      maxSelection: r.maxSelection,
      isRequired: r.isRequired,
      displayOrder: r.displayOrder,
      isActive: r.isActive,
      options: (r.options ?? []).map((o) =>
        ModifierOption.reconstitute({
          id: o.id,
          name: o.name,
          priceDelta: o.priceDelta,
          isDefault: o.isDefault,
          displayOrder: o.displayOrder,
          isActive: o.isActive,
        }),
      ),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
