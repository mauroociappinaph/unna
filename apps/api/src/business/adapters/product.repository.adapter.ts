import { Injectable } from '@nestjs/common';
import { Product as ProductRecord } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductRepositoryPort, TopSeller, Product } from '@unna/domain';
import { money } from './catalog.mappers';

@Injectable()
export class PrismaProductRepositoryAdapter implements ProductRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(product: Product): Promise<void> {
    const data = {
      businessId: product.businessId,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      type: product.type,
      status: product.status,
      basePrice: product.basePrice.toCents(),
      currency: product.basePrice.currency,
      costPrice: product.costPrice?.toCents() ?? null,
      taxRate: product.taxRate,
      sku: product.sku ?? null,
      barcode: product.barcode ?? null,
      displayOrder: product.displayOrder,
      isActive: product.isActive,
      isFavorite: product.isFavorite,
      images: product.images,
      modifierGroupIds: product.modifierGroupIds,
      components: product.components,
      preparationTimeMinutes: product.preparationTimeMinutes ?? null,
      calories: product.calories ?? null,
      allergens: product.allergens,
      tags: product.tags,
    };
    await this.prisma.product.upsert({
      where: { id: product.id },
      create: { id: product.id, ...data, createdAt: product.createdAt },
      update: data,
    });
  }

  async findById(id: string): Promise<Product | null> {
    const record = await this.prisma.product.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findByIdAndBusinessId(id: string, businessId: string): Promise<Product | null> {
    const record = await this.prisma.product.findFirst({ where: { id, businessId } });
    return record ? this.toDomain(record) : null;
  }

  async findByBusinessId(businessId: string): Promise<Product[]> {
    const records = await this.prisma.product.findMany({ where: { businessId }, orderBy: { displayOrder: 'asc' } });
    return records.map((r) => this.toDomain(r));
  }

  async findActiveByBusinessId(businessId: string): Promise<Product[]> {
    const records = await this.prisma.product.findMany({
      where: { businessId, isActive: true, status: 'active' },
      orderBy: { displayOrder: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByCategoryId(categoryId: string): Promise<Product[]> {
    const records = await this.prisma.product.findMany({ where: { categoryId }, orderBy: { displayOrder: 'asc' } });
    return records.map((r) => this.toDomain(r));
  }

  async findByBusinessIdAndStatus(businessId: string, status: string): Promise<Product[]> {
    const records = await this.prisma.product.findMany({ where: { businessId, status } });
    return records.map((r) => this.toDomain(r));
  }

  // Both the order and the product are filtered by businessId, so no other business's sales count.
  async findTopSellers(businessId: string, since: Date, limit: number): Promise<TopSeller[]> {
    const sold = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { businessId, paymentStatus: 'completed', status: { notIn: ['cancelled', 'refunded'] }, createdAt: { gte: since } },
        product: { businessId, isActive: true, status: 'active' },
      },
      _sum: { quantity: true },
      orderBy: [{ _sum: { quantity: 'desc' } }, { productId: 'asc' }],
      take: limit,
    });
    if (sold.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: sold.map((s) => s.productId) }, businessId },
      select: { id: true, name: true },
    });
    const names = new Map(products.map((p) => [p.id, p.name]));
    return sold
      .filter((s) => names.has(s.productId))
      .map((s) => ({ productId: s.productId, name: names.get(s.productId) as string, quantity: s._sum.quantity ?? 0 }));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }

  private toDomain(r: ProductRecord): Product {
    return Product.reconstitute({
      id: r.id,
      businessId: r.businessId,
      categoryId: r.categoryId,
      name: r.name,
      description: r.description ?? undefined,
      type: r.type as Product['type'],
      status: r.status as Product['status'],
      basePrice: money(r.basePrice, r.currency),
      costPrice: r.costPrice != null ? money(r.costPrice, r.currency) : undefined,
      taxRate: r.taxRate,
      sku: r.sku ?? undefined,
      barcode: r.barcode ?? undefined,
      displayOrder: r.displayOrder,
      isActive: r.isActive,
      isFavorite: r.isFavorite,
      images: r.images,
      modifierGroupIds: r.modifierGroupIds,
      components: (r.components as Product['components'] | null) ?? [],
      preparationTimeMinutes: r.preparationTimeMinutes ?? undefined,
      calories: r.calories ?? undefined,
      allergens: r.allergens,
      tags: r.tags,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}
