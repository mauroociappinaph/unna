import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CategoryRepositoryPort,
  ProductRepositoryPort,
  ModifierGroupRepositoryPort,
  PriceListRepositoryPort,
  StockLevelRepositoryPort,
  StockMovementRepositoryPort,
  Category,
  Product,
  ModifierGroup,
  ModifierOption,
  PriceList,
  PriceListEntry,
  StockLevel,
  StockMovement,
  Money,
} from '@unna/domain';

const money = (cents: number, currency = 'ARS') => Money.fromCents(cents, currency as any);

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

  private toDomain(r: any): Category {
    return Category.reconstitute({
      id: r.id,
      businessId: r.businessId,
      name: r.name,
      description: r.description ?? undefined,
      type: r.type,
      displayOrder: r.displayOrder,
      isActive: r.isActive,
      parentId: r.parentId ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}

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
      images: product.images,
      modifierGroupIds: product.modifierGroupIds,
      components: product.components as any,
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

  async delete(id: string): Promise<void> {
    await this.prisma.product.delete({ where: { id } });
  }

  private toDomain(r: any): Product {
    return Product.reconstitute({
      id: r.id,
      businessId: r.businessId,
      categoryId: r.categoryId,
      name: r.name,
      description: r.description ?? undefined,
      type: r.type,
      status: r.status,
      basePrice: money(r.basePrice, r.currency),
      costPrice: r.costPrice != null ? money(r.costPrice, r.currency) : undefined,
      taxRate: r.taxRate,
      sku: r.sku ?? undefined,
      barcode: r.barcode ?? undefined,
      displayOrder: r.displayOrder,
      isActive: r.isActive,
      images: r.images,
      modifierGroupIds: r.modifierGroupIds,
      components: (r.components as any) ?? [],
      preparationTimeMinutes: r.preparationTimeMinutes ?? undefined,
      calories: r.calories ?? undefined,
      allergens: r.allergens,
      tags: r.tags,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  }
}

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

  private toDomain(r: any): ModifierGroup {
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
      options: (r.options ?? []).map((o: any) =>
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

  private toDomain(r: any): PriceList {
    return PriceList.reconstitute({
      id: r.id,
      businessId: r.businessId,
      name: r.name,
      description: r.description ?? undefined,
      type: r.type,
      isDefault: r.isDefault,
      isActive: r.isActive,
      validFrom: r.validFrom ?? undefined,
      validTo: r.validTo ?? undefined,
      validDays: r.validDays?.length ? r.validDays : undefined,
      validFromTime: r.validFromTime ?? undefined,
      validToTime: r.validToTime ?? undefined,
      entries: (r.entries ?? []).map((e: any) =>
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

@Injectable()
export class PrismaStockLevelRepositoryAdapter implements StockLevelRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(level: StockLevel): Promise<void> {
    const data = {
      businessId: level.businessId,
      currentQuantity: level.currentQuantity,
      reservedQuantity: level.reservedQuantity,
      minThreshold: level.minThreshold,
      maxThreshold: level.maxThreshold ?? null,
      reorderPoint: level.reorderPoint,
      reorderQuantity: level.reorderQuantity,
      lastCountedAt: level.lastCountedAt ?? null,
      lastMovementAt: level.lastMovementAt ?? null,
    };
    await this.prisma.stockLevel.upsert({
      where: { productId: level.productId },
      create: { productId: level.productId, ...data },
      update: data,
    });
  }

  async findByProductId(productId: string): Promise<StockLevel | null> {
    const record = await this.prisma.stockLevel.findUnique({ where: { productId } });
    return record ? this.toDomain(record) : null;
  }

  async findByBusinessId(businessId: string): Promise<StockLevel[]> {
    const records = await this.prisma.stockLevel.findMany({ where: { businessId } });
    return records.map((r) => this.toDomain(r));
  }

  async findLowStock(businessId: string): Promise<StockLevel[]> {
    const levels = await this.findByBusinessId(businessId);
    return levels.filter((l) => l.isLowStock());
  }

  async delete(productId: string): Promise<void> {
    await this.prisma.stockLevel.delete({ where: { productId } });
  }

  private toDomain(r: any): StockLevel {
    return StockLevel.reconstitute({
      productId: r.productId,
      businessId: r.businessId,
      currentQuantity: r.currentQuantity,
      reservedQuantity: r.reservedQuantity,
      minThreshold: r.minThreshold,
      maxThreshold: r.maxThreshold ?? undefined,
      reorderPoint: r.reorderPoint,
      reorderQuantity: r.reorderQuantity,
      lastCountedAt: r.lastCountedAt ?? undefined,
      lastMovementAt: r.lastMovementAt ?? undefined,
      updatedAt: r.updatedAt,
    });
  }
}

@Injectable()
export class PrismaStockMovementRepositoryAdapter implements StockMovementRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async save(m: StockMovement): Promise<void> {
    await this.prisma.stockMovement.create({
      data: {
        id: m.id,
        productId: m.productId,
        businessId: m.businessId,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        referenceId: m.referenceId ?? null,
        referenceType: m.referenceType ?? null,
        unitCost: m.unitCost ?? null,
        totalCost: m.totalCost ?? null,
        performedBy: m.performedBy,
        createdAt: m.createdAt,
      },
    });
  }

  async findByProductId(productId: string): Promise<StockMovement[]> {
    const records = await this.prisma.stockMovement.findMany({ where: { productId }, orderBy: { createdAt: 'desc' } });
    return records.map((r) => this.toDomain(r));
  }

  async findByBusinessId(businessId: string): Promise<StockMovement[]> {
    const records = await this.prisma.stockMovement.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' } });
    return records.map((r) => this.toDomain(r));
  }

  async findByBusinessIdAndDateRange(businessId: string, from: Date, to: Date): Promise<StockMovement[]> {
    const records = await this.prisma.stockMovement.findMany({
      where: { businessId, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(r: any): StockMovement {
    return StockMovement.reconstitute({
      id: r.id,
      productId: r.productId,
      businessId: r.businessId,
      type: r.type,
      quantity: r.quantity,
      reason: r.reason,
      referenceId: r.referenceId ?? undefined,
      referenceType: r.referenceType ?? undefined,
      unitCost: r.unitCost ?? undefined,
      totalCost: r.totalCost ?? undefined,
      performedBy: r.performedBy,
      createdAt: r.createdAt,
    });
  }
}
