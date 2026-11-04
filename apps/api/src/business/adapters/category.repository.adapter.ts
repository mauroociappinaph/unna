import { Injectable } from '@nestjs/common';
import { Category as CategoryRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoryRepositoryPort, Category } from '@unna/domain';

@Injectable()
export class PrismaCategoryRepositoryAdapter implements CategoryRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(category: Category): Promise<void> {
    const data = {
      businessId: category.businessId,
      name: category.name,
      description: category.description,
      type: category.type,
      displayOrder: category.displayOrder,
      isActive: category.isActive,
      parentId: category.parentId,
      imageUrl: category.imageUrl,
    };
    await this.prisma.category.upsert({
      where: { id: category.id },
      create: { id: category.id, ...data, createdAt: category.createdAt },
      update: data,
    });
  }

  async findById(id: string): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByBusinessId(businessId: string): Promise<Category[]> {
    const records = await this.prisma.category.findMany({ where: { businessId }, orderBy: { displayOrder: 'asc' } });
    return records.map((r) => this.toDomain(r));
  }

  async findActiveByBusinessId(businessId: string): Promise<Category[]> {
    const records = await this.prisma.category.findMany({
      where: { businessId, isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByIdAndBusinessId(id: string, businessId: string): Promise<Category | null> {
    const record = await this.prisma.category.findFirst({ where: { id, businessId } });
    return record ? this.toDomain(record) : null;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }

  private toDomain(r: CategoryRecord): Category {
    return Category.reconstitute({
      id: r.id,
      businessId: r.businessId,
      name: r.name,
      description: r.description ?? undefined,
      type: r.type as Category['type'],
      displayOrder: r.displayOrder,
      isActive: r.isActive,
      parentId: r.parentId ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
