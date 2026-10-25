import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessRepositoryPort } from '@unna/domain';
import { Business, BusinessName } from '@unna/domain';

@Injectable()
export class PrismaBusinessRepositoryAdapter implements BusinessRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(business: Business): Promise<void> {
    const props = this.toPrisma(business);
    await this.prisma.business.upsert({
      where: { id: business.id },
      create: props,
      update: props,
    });
  }

  async findById(id: string): Promise<Business | null> {
    const record = await this.prisma.business.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByOwnerId(ownerId: string): Promise<Business[]> {
    const records = await this.prisma.business.findMany({ where: { ownerId } });
    return records.map(this.toDomain);
  }

  async existsByName(name: string): Promise<boolean> {
    const count = await this.prisma.business.count({ where: { name } });
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
      ownerId: business.ownerId,
      isActive: business.isActive,
      settings: business.settings,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  private toDomain(record: any): Business {
    return Business.reconstitute(record.id, {
      name: BusinessName.create(record.name),
      ownerId: record.ownerId,
      slug: record.slug,
      isActive: record.isActive,
      settings: record.settings as Business['settings'],
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }
}