import { Inject, Injectable } from '@nestjs/common';
import { CategoryRepositoryPort, ProductRepositoryPort, ModifierGroupRepositoryPort, PriceListRepositoryPort, StockLevelRepositoryPort, StockMovementRepositoryPort, TopSeller } from '@unna/domain';
import { Category, Product, ModifierGroup, ModifierOption, PriceList, PriceListEntry, StockLevel, StockMovement, Money, StockMovementType } from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';

interface CategoryInput {
  name: string;
  description?: string;
  type: 'plato' | 'bebida' | 'postre' | 'extra' | 'combo';
  displayOrder?: number;
  isActive?: boolean;
  parentId?: string;
  imageUrl?: string;
}

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

interface ModifierOptionInput {
  name: string;
  priceDelta?: number;
  isDefault?: boolean;
  displayOrder?: number;
  isActive?: boolean;
}

interface ModifierGroupInput {
  name: string;
  description?: string;
  minSelection?: number;
  maxSelection?: number;
  isRequired?: boolean;
  displayOrder?: number;
  isActive?: boolean;
  options?: Array<ModifierOptionInput>;
}

interface PriceListInput {
  name: string;
  description?: string;
  type: 'standard' | 'delivery' | 'takeaway' | 'happy-hour' | 'event' | 'custom';
  isDefault?: boolean;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
  validDays?: number[];
  validFromTime?: string;
  validToTime?: string;
  entries?: Array<{
    productId: string;
    price: number;
    costPrice?: number;
    isActive?: boolean;
  }>;
}

interface StockMovementInput {
  productId: string;
  type: 'in' | 'out' | 'adjustment' | 'waste' | 'transfer' | 'sale' | 'return';
  quantity: number;
  reason: string;
  referenceId?: string;
  referenceType?: string;
  unitCost?: number;
  totalCost?: number;
  performedBy: string;
}

/** Stock entries and exits: the movement fields the caller sends; the user performing it is the owner. */
type StockMovementCommand = Omit<StockMovementInput, 'type' | 'performedBy'>;

export interface StockChange {
  level: StockLevel;
  movement: StockMovement;
}

@Injectable()
export class CategoryUseCase {
  constructor(
    @Inject('CategoryRepositoryPort')
    private readonly categoryRepository: CategoryRepositoryPort,
  ) {}

  async create(command: { businessId: string; ownerId: string } & CategoryInput): Promise<UseCaseResult<Category>> {
    const parentError = await this.checkParent(command.parentId, command.businessId);
    if (parentError) return parentError;
    const category = Category.create({
      ...command,
      businessId: command.businessId,
      displayOrder: command.displayOrder ?? 0,
      isActive: command.isActive ?? true,
    });
    await this.categoryRepository.save(category);
    return { ok: true, value: category };
  }

  async update(command: { id: string; businessId: string; ownerId: string } & Partial<CategoryInput>): Promise<UseCaseResult<Category>> {
    let category = await this.categoryRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!category) return { ok: false, error: new Error('Categoría no encontrada') };
    if (command.parentId === command.id) return { ok: false, error: new Error('Una categoría no puede ser su propia categoría padre') };
    const parentError = await this.checkParent(command.parentId, command.businessId);
    if (parentError) return parentError;

    if (command.name !== undefined) category = category.updateName(command.name);
    if (command.description !== undefined) category = category.updateDescription(command.description);
    if (command.type !== undefined) category = category.updateType(command.type);
    if (command.displayOrder !== undefined) category = category.updateDisplayOrder(command.displayOrder);
    if (command.parentId !== undefined) category = category.setParent(command.parentId);
    if (command.imageUrl !== undefined) category = category.updateImage(command.imageUrl);
    if (command.isActive !== undefined) {
      category = command.isActive ? category.activate() : category.deactivate();
    }

    await this.categoryRepository.save(category);
    return { ok: true, value: category };
  }

  async delete(command: { id: string; businessId: string; ownerId: string }): Promise<UseCaseResult<void>> {
    const category = await this.categoryRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!category) return { ok: false, error: new Error('Categoría no encontrada') };
    await this.categoryRepository.delete(command.id);
    return { ok: true };
  }

  async getById(id: string, businessId: string): Promise<UseCaseResult<Category>> {
    const category = await this.categoryRepository.findByIdAndBusinessId(id, businessId);
    return category ? { ok: true, value: category } : { ok: false, error: new Error('Categoría no encontrada') };
  }

  private async checkParent(parentId: string | undefined, businessId: string): Promise<UseCaseResult<never> | null> {
    if (!parentId) return null;
    const parent = await this.categoryRepository.findByIdAndBusinessId(parentId, businessId);
    return parent ? null : { ok: false, error: new Error('Categoría padre no encontrada') };
  }

  async list(businessId: string, activeOnly = false): Promise<UseCaseResult<Category[]>> {
    const categories = activeOnly 
      ? await this.categoryRepository.findActiveByBusinessId(businessId)
      : await this.categoryRepository.findByBusinessId(businessId);
    return { ok: true, value: categories };
  }
}

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

@Injectable()
export class ModifierGroupUseCase {
  constructor(
    @Inject('ModifierGroupRepositoryPort')
    private readonly groupRepository: ModifierGroupRepositoryPort,
  ) {}

  async create(command: { businessId: string; ownerId: string } & ModifierGroupInput): Promise<UseCaseResult<ModifierGroup>> {
    const group = ModifierGroup.create({
      businessId: command.businessId,
      name: command.name,
      description: command.description,
      minSelection: command.minSelection ?? 0,
      maxSelection: command.maxSelection ?? 0,
      isRequired: command.isRequired ?? false,
      displayOrder: command.displayOrder ?? 0,
      isActive: command.isActive ?? true,
      options: command.options?.map((o) => ModifierOption.create({
        name: o.name,
        priceDelta: o.priceDelta ?? 0,
        isDefault: o.isDefault ?? false,
        displayOrder: o.displayOrder ?? 0,
        isActive: o.isActive ?? true,
      })) ?? [],
    });
    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async update(command: { id: string; businessId: string; ownerId: string } & Partial<ModifierGroupInput>): Promise<UseCaseResult<ModifierGroup>> {
    let group = await this.groupRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo de modificadores no encontrado') };

    if (command.name !== undefined) group = group.updateName(command.name);
    if (command.description !== undefined) group = group.updateDescription(command.description);
    if (command.minSelection !== undefined) group = group.setMinSelection(command.minSelection);
    if (command.maxSelection !== undefined) group = group.setMaxSelection(command.maxSelection);
    if (command.isRequired !== undefined) group = group.setRequired(command.isRequired);
    if (command.isActive !== undefined) {
      group = command.isActive ? group.activate() : group.deactivate();
    }

    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async addOption(command: { groupId: string; businessId: string; ownerId: string; option: ModifierOptionInput }): Promise<UseCaseResult<ModifierGroup>> {
    let group = await this.groupRepository.findByIdAndBusinessId(command.groupId, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo no encontrado') };
    const option = ModifierOption.create({
      name: command.option.name,
      priceDelta: command.option.priceDelta ?? 0,
      isDefault: command.option.isDefault ?? false,
      displayOrder: command.option.displayOrder ?? 0,
      isActive: command.option.isActive ?? true,
    });
    group = group.addOption(option);
    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async updateOption(command: { groupId: string; businessId: string; ownerId: string; optionId: string; updates: Partial<ModifierOptionInput> }): Promise<UseCaseResult<ModifierGroup>> {
    let group = await this.groupRepository.findByIdAndBusinessId(command.groupId, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo no encontrado') };
    group = group.updateOption(command.optionId, (o: ModifierOption) => {
      if (command.updates.name !== undefined) o = o.updateName(command.updates.name);
      if (command.updates.priceDelta !== undefined) o = o.updatePriceDelta(command.updates.priceDelta);
      if (command.updates.isDefault !== undefined) o = command.updates.isDefault ? o.setAsDefault() : o.unsetAsDefault();
      if (command.updates.isActive !== undefined) o = command.updates.isActive ? o.activate() : o.deactivate();
      return o;
    });
    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async deleteOption(command: { groupId: string; businessId: string; ownerId: string; optionId: string }): Promise<UseCaseResult<ModifierGroup>> {
    let group = await this.groupRepository.findByIdAndBusinessId(command.groupId, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo no encontrado') };
    group = group.removeOption(command.optionId);
    await this.groupRepository.save(group);
    return { ok: true, value: group };
  }

  async delete(command: { id: string; businessId: string; ownerId: string }): Promise<UseCaseResult<void>> {
    const group = await this.groupRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!group) return { ok: false, error: new Error('Grupo no encontrado') };
    await this.groupRepository.delete(command.id);
    return { ok: true };
  }

  async getById(id: string, businessId: string): Promise<UseCaseResult<ModifierGroup>> {
    const group = await this.groupRepository.findByIdAndBusinessId(id, businessId);
    return group ? { ok: true, value: group } : { ok: false, error: new Error('Grupo no encontrado') };
  }

  async list(businessId: string, activeOnly = false): Promise<UseCaseResult<ModifierGroup[]>> {
    const groups = activeOnly 
      ? await this.groupRepository.findActiveByBusinessId(businessId)
      : await this.groupRepository.findByBusinessId(businessId);
    return { ok: true, value: groups };
  }
}

@Injectable()
export class PriceListUseCase {
  constructor(
    @Inject('PriceListRepositoryPort')
    private readonly listRepository: PriceListRepositoryPort,
    @Inject('ProductRepositoryPort')
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async create(command: { businessId: string; ownerId: string } & PriceListInput): Promise<UseCaseResult<PriceList>> {
    // Validate products exist
    if (command.entries) {
      for (const entry of command.entries) {
        const product = await this.productRepository.findByIdAndBusinessId(entry.productId, command.businessId);
        if (!product) return { ok: false, error: new Error(`Producto ${entry.productId} no encontrado`) };
      }
    }

    const list = PriceList.create({
      businessId: command.businessId,
      name: command.name,
      description: command.description,
      type: command.type,
      isDefault: command.isDefault ?? false,
      isActive: command.isActive ?? true,
      validFrom: command.validFrom ? new Date(command.validFrom) : undefined,
      validTo: command.validTo ? new Date(command.validTo) : undefined,
      validDays: command.validDays,
      validFromTime: command.validFromTime,
      validToTime: command.validToTime,
      entries: command.entries?.map((e) => PriceListEntry.create({
        productId: e.productId,
        price: Money.fromCents(e.price, 'ARS'),
        costPrice: e.costPrice ? Money.fromCents(e.costPrice, 'ARS') : undefined,
        isActive: e.isActive ?? true,
      })) ?? [],
    });

    // If this is set as default, unset others
    if (command.isDefault) {
      const lists = await this.listRepository.findActiveByBusinessId(command.businessId);
      for (const other of lists) {
        if (other.isDefault) {
          await this.listRepository.save(other.unsetAsDefault());
        }
      }
    }

    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async update(command: { id: string; businessId: string; ownerId: string } & Partial<PriceListInput>): Promise<UseCaseResult<PriceList>> {
    let list = await this.listRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista de precios no encontrada') };

    if (command.name !== undefined) list = list.updateName(command.name);
    if (command.description !== undefined) list = list.updateDescription(command.description);
    if (command.isDefault !== undefined) list = command.isDefault ? list.setAsDefault() : list.unsetAsDefault();
    if (command.isActive !== undefined) list = command.isActive ? list.activate() : list.deactivate();
    if (command.validFrom !== undefined || command.validTo !== undefined) list = list.setValidityPeriod(command.validFrom ? new Date(command.validFrom) : undefined, command.validTo ? new Date(command.validTo) : undefined);
    if (command.validDays !== undefined) list = list.setValidDays(command.validDays);
    if (command.validFromTime !== undefined || command.validToTime !== undefined) list = list.setValidHours(command.validFromTime, command.validToTime);

    // If setting as default, unset others
    if (command.isDefault) {
      const lists = await this.listRepository.findActiveByBusinessId(command.businessId);
      for (const other of lists) {
        if (other.id !== command.id && other.isDefault) {
          await this.listRepository.save(other.unsetAsDefault());
        }
      }
    }

    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async addEntry(command: { listId: string; businessId: string; ownerId: string; productId: string; price: number; costPrice?: number; isActive?: boolean }): Promise<UseCaseResult<PriceList>> {
    let list = await this.listRepository.findByIdAndBusinessId(command.listId, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista no encontrada') };

    const product = await this.productRepository.findByIdAndBusinessId(command.productId, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };

    const entry = PriceListEntry.create({
      productId: command.productId,
      price: Money.fromCents(command.price, 'ARS'),
      costPrice: command.costPrice ? Money.fromCents(command.costPrice, 'ARS') : undefined,
      isActive: command.isActive ?? true,
    });

    list = list.addEntry(entry);
    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async updateEntry(command: { listId: string; businessId: string; ownerId: string; productId: string; price?: number; costPrice?: number; isActive?: boolean }): Promise<UseCaseResult<PriceList>> {
    let list = await this.listRepository.findByIdAndBusinessId(command.listId, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista no encontrada') };

    if (command.price !== undefined) list = list.setEntryPrice(command.productId, Money.fromCents(command.price, 'ARS'));
    if (command.costPrice !== undefined) list = list.updateEntry(command.productId, (e: PriceListEntry) => e.updateCostPrice(command.costPrice ? Money.fromCents(command.costPrice, 'ARS') : undefined));
    if (command.isActive !== undefined) list = list.updateEntry(command.productId, (e: PriceListEntry) => command.isActive ? e.activate() : e.deactivate());

    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async removeEntry(command: { listId: string; businessId: string; ownerId: string; productId: string }): Promise<UseCaseResult<PriceList>> {
    let list = await this.listRepository.findByIdAndBusinessId(command.listId, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista no encontrada') };
    list = list.removeEntry(command.productId);
    await this.listRepository.save(list);
    return { ok: true, value: list };
  }

  async delete(command: { id: string; businessId: string; ownerId: string }): Promise<UseCaseResult<void>> {
    const list = await this.listRepository.findByIdAndBusinessId(command.id, command.businessId);
    if (!list) return { ok: false, error: new Error('Lista no encontrada') };
    await this.listRepository.delete(command.id);
    return { ok: true };
  }

  async getById(id: string, businessId: string): Promise<UseCaseResult<PriceList>> {
    const list = await this.listRepository.findByIdAndBusinessId(id, businessId);
    return list ? { ok: true, value: list } : { ok: false, error: new Error('Lista no encontrada') };
  }

  async list(businessId: string, activeOnly = false): Promise<UseCaseResult<PriceList[]>> {
    const lists = activeOnly 
      ? await this.listRepository.findActiveByBusinessId(businessId)
      : await this.listRepository.findByBusinessId(businessId);
    return { ok: true, value: lists };
  }

  async getDefault(businessId: string): Promise<UseCaseResult<PriceList>> {
    const list = await this.listRepository.findDefaultByBusinessId(businessId);
    return list ? { ok: true, value: list } : { ok: false, error: new Error('No hay lista por defecto') };
  }
}

@Injectable()
export class StockUseCase {
  constructor(
    @Inject('StockLevelRepositoryPort')
    private readonly stockRepository: StockLevelRepositoryPort,
    @Inject('StockMovementRepositoryPort')
    private readonly movementRepository: StockMovementRepositoryPort,
    @Inject('ProductRepositoryPort')
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  async addStock(command: { businessId: string; ownerId: string } & StockMovementCommand): Promise<UseCaseResult<StockChange>> {
    const product = await this.productRepository.findByIdAndBusinessId(command.productId, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };

    const level = await this.stockRepository.findByProductId(command.productId);
    if (!level) {
      return { ok: false, error: new Error('Nivel de stock no inicializado para este producto') };
    }

    const movement = StockMovement.create({
      productId: command.productId,
      businessId: command.businessId,
      type: 'in',
      quantity: command.quantity,
      reason: command.reason,
      referenceId: command.referenceId,
      referenceType: command.referenceType,
      unitCost: command.unitCost,
      totalCost: command.totalCost,
      performedBy: command.ownerId,
    });

    const updatedLevel = level.addStock(command.quantity, movement);
    await this.stockRepository.save(updatedLevel);
    await this.movementRepository.save(movement);

    return { ok: true, value: { level: updatedLevel, movement } };
  }

  async removeStock(command: { businessId: string; ownerId: string; type?: StockMovementType } & StockMovementCommand): Promise<UseCaseResult<StockChange>> {
    const product = await this.productRepository.findByIdAndBusinessId(command.productId, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };

    const level = await this.stockRepository.findByProductId(command.productId);
    if (!level) return { ok: false, error: new Error('Nivel de stock no encontrado') };

    const movement = StockMovement.create({
      productId: command.productId,
      businessId: command.businessId,
      type: command.type ?? 'out',
      quantity: command.quantity,
      reason: command.reason,
      referenceId: command.referenceId,
      referenceType: command.referenceType,
      unitCost: command.unitCost,
      totalCost: command.totalCost,
      performedBy: command.ownerId,
    });

    const updatedLevel = level.removeStock(command.quantity, movement);
    await this.stockRepository.save(updatedLevel);
    await this.movementRepository.save(movement);

    return { ok: true, value: { level: updatedLevel, movement } };
  }

  private async productMissing(productId: string, businessId: string): Promise<UseCaseResult<never> | null> {
    const product = await this.productRepository.findByIdAndBusinessId(productId, businessId);
    return product ? null : { ok: false, error: new Error('Producto no encontrado') };
  }

  async recordCount(command: { productId: string; businessId: string; ownerId: string; countedQuantity: number }): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(command.productId, command.businessId);
    if (missing) return missing;
    const level = await this.stockRepository.findByProductId(command.productId);
    if (!level) return { ok: false, error: new Error('Nivel de stock no encontrado') };

    const updatedLevel = level.recordCount(command.countedQuantity);
    await this.stockRepository.save(updatedLevel);
    return { ok: true, value: updatedLevel };
  }

  async adjustThresholds(command: { productId: string; businessId: string; ownerId: string; minThreshold?: number; maxThreshold?: number; reorderPoint?: number; reorderQuantity?: number }): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(command.productId, command.businessId);
    if (missing) return missing;
    const level = await this.stockRepository.findByProductId(command.productId);
    if (!level) return { ok: false, error: new Error('Nivel de stock no encontrado') };

    const updatedLevel = level.adjustThresholds(command.minThreshold, command.maxThreshold, command.reorderPoint, command.reorderQuantity);
    await this.stockRepository.save(updatedLevel);
    return { ok: true, value: updatedLevel };
  }

  async initializeStock(command: { productId: string; businessId: string; ownerId: string; initialQuantity: number; minThreshold?: number; reorderPoint?: number; reorderQuantity?: number }): Promise<UseCaseResult<StockLevel>> {
    const product = await this.productRepository.findByIdAndBusinessId(command.productId, command.businessId);
    if (!product) return { ok: false, error: new Error('Producto no encontrado') };

    const existing = await this.stockRepository.findByProductId(command.productId);
    if (existing) return { ok: false, error: new Error('El stock ya está inicializado para este producto') };

    const level = StockLevel.create({
      productId: command.productId,
      businessId: command.businessId,
      currentQuantity: command.initialQuantity,
      reservedQuantity: 0,
      minThreshold: command.minThreshold ?? 10,
      reorderPoint: command.reorderPoint ?? 5,
      reorderQuantity: command.reorderQuantity ?? 20,
    });

    await this.stockRepository.save(level);

    const movement = StockMovement.create({
      productId: command.productId,
      businessId: command.businessId,
      type: 'in',
      quantity: command.initialQuantity,
      reason: 'Stock inicial',
      performedBy: command.ownerId,
    });
    await this.movementRepository.save(movement);

    return { ok: true, value: level };
  }

  async getLevel(productId: string, businessId: string): Promise<UseCaseResult<StockLevel>> {
    const missing = await this.productMissing(productId, businessId);
    if (missing) return missing;
    const level = await this.stockRepository.findByProductId(productId);
    return level ? { ok: true, value: level } : { ok: false, error: new Error('Nivel de stock no encontrado') };
  }

  async getLowStock(businessId: string): Promise<UseCaseResult<StockLevel[]>> {
    const levels = await this.stockRepository.findLowStock(businessId);
    return { ok: true, value: levels };
  }

  async listByBusiness(businessId: string): Promise<UseCaseResult<StockLevel[]>> {
    const levels = await this.stockRepository.findByBusinessId(businessId);
    return { ok: true, value: levels };
  }

  async listMovements(businessId: string, filters?: { productId?: string; from?: Date; to?: Date }): Promise<UseCaseResult<StockMovement[]>> {
    let movements: StockMovement[];
    if (filters?.from && filters?.to) {
      movements = await this.movementRepository.findByBusinessIdAndDateRange(businessId, filters.from, filters.to);
    } else if (filters?.productId) {
      const missing = await this.productMissing(filters.productId, businessId);
      if (missing) return missing;
      movements = await this.movementRepository.findByProductId(filters.productId);
    } else {
      movements = await this.movementRepository.findByBusinessId(businessId);
    }
    return { ok: true, value: movements };
  }
}