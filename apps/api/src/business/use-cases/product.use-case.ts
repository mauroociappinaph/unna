import { Inject, Injectable } from '@nestjs/common';
import { CategoryRepositoryPort, ProductRepositoryPort, ModifierGroupRepositoryPort, TopSeller, Product, Money } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

export interface ProductInput {
  categoryId: string;
  name: string;
  description?: string;
  type: 'simple' | 'composite' | 'combo';
  status?: 'draft' | 'active' | 'archived';
  basePrice: number; // in cents
  currency?: Money['currency'];
  costPrice?: number;
  taxRate?: number;
  sku?: string;
  barcode?: string;
  displayOrder?: number;
  isActive?: boolean;
  images?: string[];
  modifierGroupIds?: string[];
  components?: Array<{ productId: string; quantity: number }>;
  preparationTimeMinutes?: number;
  calories?: number;
  allergens?: string[];
  tags?: string[];
  isFavorite?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ProductUseCase {
  constructor(
    @Inject('ProductRepositoryPort')
    private readonly productRepository: ProductRepositoryPort,
    @Inject('CategoryRepositoryPort')
    private readonly categoryRepository: CategoryRepositoryPort,
    @Inject('ModifierGroupRepositoryPort')
    private readonly modifierGroupRepository: ModifierGroupRepositoryPort,
  ) {}

  /** Every id a product references must belong to the same business. */
  private async checkReferences(
    businessId: string,
    refs: { modifierGroupIds?: string[]; components?: Array<{ productId: string }> },
  ): Promise<UseCaseResult<never> | null> {
    for (const groupId of refs.modifierGroupIds ?? []) {
      if (!(await this.modifierGroupRepository.findByIdAndBusinessId(groupId, businessId))) {
        return { ok: false, error: new Error(`Grupo de modificadores ${groupId} no encontrado`) };
      }
    }
    for (const component of refs.components ?? []) {
      if (!(await this.productRepository.findByIdAndBusinessId(component.productId, businessId))) {
        return { ok: false, error: new Error(`Producto componente ${component.productId} no encontrado`) };
      }
    }
    return null;
  }

  async create(command: { businessId: string; ownerId: string } & ProductInput): Promise<UseCaseResult<Product>> {
    // Validate category exists and belongs to business
    const category = await this.categoryRepository.findByIdAndBusinessId(command.categoryId, command.businessId);
    if (!category) return { ok: false, error: new Error('Categoría no encontrada') };
    const refError = await this.checkReferences(command.businessId, command);
    if (refError) return refError;

    const product = Product.create({
      businessId: command.businessId,
      categoryId: command.categoryId,
      name: command.name,
      description: command.description,
      type: command.type,
      status: command.status ?? 'draft',
      basePrice: Money.fromCents(command.basePrice, command.currency ?? 'ARS'),
      costPrice: command.costPrice ? Money.fromCents(command.costPrice, command.currency ?? 'ARS') : undefined,
      taxRate: command.taxRate ?? 21,
      sku: command.sku,
      barcode: command.barcode,
      displayOrder: command.displayOrder ?? 0,
      isActive: command.isActive ?? true,
      images: command.images ?? [],
      modifierGroupIds: command.modifierGroupIds ?? [],
      components: command.components,
      preparationTimeMinutes: command.preparationTimeMinutes,
      calories: command.calories,
      allergens: command.allergens,
      tags: command.tags,
      isFavorite: command.isFavorite ?? false,
    });

    await this.productRepository.save(product);
    return { ok: true, value: product };
  }

  async update(command: { id: string; businessId: string; ownerId: string } & Partial<ProductInput>): Promise<UseCaseResult<Product>> {
    let product = await this.productRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };
    const refError = await this.checkReferences(command.businessId, command);
    if (refError) return refError;

    if (command.name !== undefined) product = product.updateName(command.name);
    if (command.description !== undefined) product = product.updateDescription(command.description);
    if (command.basePrice !== undefined) product = product.updateBasePrice(Money.fromCents(command.basePrice, 'ARS'));
    if (command.costPrice !== undefined) product = product.updateCostPrice(command.costPrice ? Money.fromCents(command.costPrice, 'ARS') : undefined);
    if (command.taxRate !== undefined) product = product.updateTaxRate(command.taxRate);
    if (command.sku !== undefined) product = product.updateSKU(command.sku);
    if (command.barcode !== undefined) product = product.updateBarcode(command.barcode);
    if (command.displayOrder !== undefined) product = product.setDisplayOrder(command.displayOrder);
    if (command.images !== undefined) {
      product = Product.reconstitute({
        ...product,
        images: command.images,
        updatedAt: new Date(),
      });
    }
    if (command.modifierGroupIds !== undefined) product = product.setModifierGroups(command.modifierGroupIds);
    if (command.components !== undefined) {
      product = Product.reconstitute({
        ...product,
        components: command.components,
        updatedAt: new Date(),
      });
    }
    if (command.preparationTimeMinutes !== undefined) product = product.setPreparationTime(command.preparationTimeMinutes);
    if (command.calories !== undefined) product = product.setCalories(command.calories);
    if (command.allergens !== undefined) {
      product = Product.reconstitute({
        ...product,
        allergens: command.allergens,
        updatedAt: new Date(),
      });
    }
    if (command.tags !== undefined) {
      product = Product.reconstitute({
        ...product,
        tags: command.tags,
        updatedAt: new Date(),
      });
    }
    if (command.status !== undefined) {
      if (command.status === 'active') product = product.activate();
      else if (command.status === 'archived') product = product.archive();
      else product = Product.reconstitute({ ...product, status: command.status, updatedAt: new Date() });
    }
    if (command.isActive !== undefined) {
      product = command.isActive ? product.activate() : product.deactivate();
    }
    if (command.isFavorite !== undefined) product = product.setFavorite(command.isFavorite);

    await this.productRepository.save(product);
    return { ok: true, value: product };
  }

  async delete(command: { id: string; businessId: string; ownerId: string }): Promise<UseCaseResult<void>> {
    const product = await this.productRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };
    await this.productRepository.delete(command.id);
    return { ok: true };
  }

  async getById(id: string, businessId: string): Promise<UseCaseResult<Product>> {
    const product = await this.productRepository.findByIdAndBusinessId(id, businessId);
    return product ? { ok: true, value: product } : { ok: false, error: new Error('Producto no encontrado') };
  }

  /** Most sold active products of the business in the last `days` days (default 7), up to `limit` (default 8). */
  async topSellers(businessId: string, query: { days?: number; limit?: number }, now = new Date()): Promise<UseCaseResult<TopSeller[]>> {
    const days = query.days ?? 7;
    const limit = query.limit ?? 8;
    if (!Number.isInteger(days) || days < 1 || days > 30) return { ok: false, error: new Error('El período debe ser de 1 a 30 días') };
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) return { ok: false, error: new Error('La cantidad debe ser de 1 a 20 productos') };
    const since = new Date(now.getTime() - days * DAY_MS);
    return { ok: true, value: await this.productRepository.findTopSellers(businessId, since, limit) };
  }

  async list(businessId: string, filters?: { status?: string; categoryId?: string; activeOnly?: boolean }): Promise<UseCaseResult<Product[]>> {
    let products: Product[];
    if (filters?.categoryId) {
      const category = await this.categoryRepository.findByIdAndBusinessId(filters.categoryId, businessId);
      if (!category) return { ok: false, error: new Error('Categoría no encontrada') };
      products = await this.productRepository.findByCategoryId(filters.categoryId);
    } else if (filters?.status) {
      products = await this.productRepository.findByBusinessIdAndStatus(businessId, filters.status);
    } else if (filters?.activeOnly) {
      products = await this.productRepository.findActiveByBusinessId(businessId);
    } else {
      products = await this.productRepository.findByBusinessId(businessId);
    }
    return { ok: true, value: products };
  }
}
