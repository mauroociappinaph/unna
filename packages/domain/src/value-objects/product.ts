import { Money } from './money';
import { ModifierGroup } from './modifier';

export type ProductType = 'simple' | 'composite' | 'combo';
export type ProductStatus = 'draft' | 'active' | 'archived';

export interface ProductProps {
  id: string;
  businessId: string;
  categoryId: string;
  name: string;
  description?: string;
  type: ProductType;
  status: ProductStatus;
  basePrice: Money;
  costPrice?: Money;
  taxRate: number;  // percentage (e.g., 21 for 21% IVA)
  sku?: string;
  barcode?: string;
  displayOrder: number;
  isActive: boolean;
  images: string[];
  modifierGroupIds: string[];
  // For composite/combo products
  components?: Array<{ productId: string; quantity: number }>;
  preparationTimeMinutes?: number;
  calories?: number;
  allergens?: string[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class Product {
  public readonly id: string;
  public readonly businessId: string;
  public readonly categoryId: string;
  public readonly name: string;
  public readonly description: string | undefined;
  public readonly type: ProductType;
  public readonly status: ProductStatus;
  public readonly basePrice: Money;
  public readonly costPrice: Money | undefined;
  public readonly taxRate: number;
  public readonly sku: string | undefined;
  public readonly barcode: string | undefined;
  public readonly displayOrder: number;
  public readonly isActive: boolean;
  public readonly images: string[];
  public readonly modifierGroupIds: string[];
  public readonly components: Array<{ productId: string; quantity: number }>;
  public readonly preparationTimeMinutes: number | undefined;
  public readonly calories: number | undefined;
  public readonly allergens: string[];
  public readonly tags: string[];
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: ProductProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.categoryId = props.categoryId;
    this.name = props.name.trim();
    this.description = props.description?.trim();
    this.type = props.type;
    this.status = props.status;
    this.basePrice = props.basePrice;
    this.costPrice = props.costPrice;
    this.taxRate = props.taxRate;
    this.sku = props.sku?.trim();
    this.barcode = props.barcode?.trim();
    this.displayOrder = props.displayOrder;
    this.isActive = props.isActive;
    this.images = props.images;
    this.modifierGroupIds = props.modifierGroupIds;
    this.components = props.components ?? [];
    this.preparationTimeMinutes = props.preparationTimeMinutes;
    this.calories = props.calories;
    this.allergens = props.allergens ?? [];
    this.tags = props.tags ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: Omit<ProductProps, 'id' | 'createdAt' | 'updatedAt'>): Product {
    if (!props.name || !props.name.trim()) {
      throw new Error('Nombre de producto es obligatorio');
    }
    if (props.name.length > 100) {
      throw new Error('Nombre no puede exceder 100 caracteres');
    }
    if (props.description && props.description.length > 1000) {
      throw new Error('Descripción no puede exceder 1000 caracteres');
    }
    if (props.basePrice.amount < 0) {
      throw new Error('Precio base no puede ser negativo');
    }
    if (props.costPrice && props.costPrice.amount < 0) {
      throw new Error('Precio de costo no puede ser negativo');
    }
    if (props.taxRate < 0 || props.taxRate > 100) {
      throw new Error('Tasa de impuesto debe estar entre 0 y 100');
    }

    const validTypes: ProductType[] = ['simple', 'composite', 'combo'];
    if (!validTypes.includes(props.type)) {
      throw new Error('Tipo de producto inválido');
    }

    const validStatuses: ProductStatus[] = ['draft', 'active', 'archived'];
    if (!validStatuses.includes(props.status)) {
      throw new Error('Estado de producto inválido');
    }

    if (props.type === 'composite' || props.type === 'combo') {
      if (!props.components || props.components.length === 0) {
        throw new Error('Productos compuestos/combo deben tener al menos un componente');
      }
    }

    if (props.sku && props.sku.length > 50) {
      throw new Error('SKU no puede exceder 50 caracteres');
    }
    if (props.barcode && props.barcode.length > 100) {
      throw new Error('Código de barras no puede exceder 100 caracteres');
    }

    const now = new Date();
    return new Product({
      ...props,
      id: crypto.randomUUID(),
      name: props.name.trim(),
      description: props.description?.trim(),
      images: props.images ?? [],
      modifierGroupIds: props.modifierGroupIds ?? [],
      components: props.components ?? [],
      preparationTimeMinutes: props.preparationTimeMinutes,
      calories: props.calories,
      allergens: props.allergens ?? [],
      tags: props.tags ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  public updateName(name: string): Product {
    if (!name || !name.trim()) throw new Error('Nombre es obligatorio');
    return new Product({ ...this.toProps(), name: name.trim(), updatedAt: new Date() });
  }

  public updateDescription(description?: string): Product {
    if (description && description.length > 1000) {
      throw new Error('Descripción no puede exceder 1000 caracteres');
    }
    return new Product({ ...this.toProps(), description: description?.trim(), updatedAt: new Date() });
  }

  public updateBasePrice(price: Money): Product {
    if (price.amount < 0) throw new Error('Precio no puede ser negativo');
    return new Product({ ...this.toProps(), basePrice: price, updatedAt: new Date() });
  }

  public updateCostPrice(price?: Money): Product {
    if (price && price.amount < 0) throw new Error('Precio de costo no puede ser negativo');
    return new Product({ ...this.toProps(), costPrice: price, updatedAt: new Date() });
  }

  public updateTaxRate(rate: number): Product {
    if (rate < 0 || rate > 100) throw new Error('Tasa de impuesto inválida');
    return new Product({ ...this.toProps(), taxRate: rate, updatedAt: new Date() });
  }

  public updateSKU(sku?: string): Product {
    if (sku && sku.length > 50) throw new Error('SKU no puede exceder 50 caracteres');
    return new Product({ ...this.toProps(), sku: sku?.trim(), updatedAt: new Date() });
  }

  public updateBarcode(barcode?: string): Product {
    if (barcode && barcode.length > 100) throw new Error('Código de barras no puede exceder 100 caracteres');
    return new Product({ ...this.toProps(), barcode: barcode?.trim(), updatedAt: new Date() });
  }

  public setDisplayOrder(order: number): Product {
    if (order < 0) throw new Error('Orden no puede ser negativo');
    return new Product({ ...this.toProps(), displayOrder: order, updatedAt: new Date() });
  }

  public addImage(imageUrl: string): Product {
    if (this.images.length >= 10) throw new Error('Máximo 10 imágenes por producto');
    return new Product({ ...this.toProps(), images: [...this.images, imageUrl], updatedAt: new Date() });
  }

  public removeImage(imageUrl: string): Product {
    return new Product({
      ...this.toProps(),
      images: this.images.filter(img => img !== imageUrl),
      updatedAt: new Date(),
    });
  }

  public reorderImages(imageUrls: string[]): Product {
    return new Product({ ...this.toProps(), images: imageUrls, updatedAt: new Date() });
  }

  public addModifierGroup(groupId: string): Product {
    if (this.modifierGroupIds.includes(groupId)) return this;
    return new Product({ ...this.toProps(), modifierGroupIds: [...this.modifierGroupIds, groupId], updatedAt: new Date() });
  }

  public removeModifierGroup(groupId: string): Product {
    return new Product({
      ...this.toProps(),
      modifierGroupIds: this.modifierGroupIds.filter(id => id !== groupId),
      updatedAt: new Date(),
    });
  }

  public setModifierGroups(groupIds: string[]): Product {
    return new Product({ ...this.toProps(), modifierGroupIds: groupIds, updatedAt: new Date() });
  }

  // For composite/combo products
  public addComponent(productId: string, quantity: number): Product {
    if (this.type === 'simple') throw new Error('Solo productos compuestos/combo pueden tener componentes');
    if (quantity <= 0) throw new Error('Cantidad debe ser mayor a 0');
    if (this.components.some(c => c.productId === productId)) {
      throw new Error('El producto ya es un componente');
    }
    return new Product({
      ...this.toProps(),
      components: [...this.components, { productId, quantity }],
      updatedAt: new Date(),
    });
  }

  public removeComponent(productId: string): Product {
    return new Product({
      ...this.toProps(),
      components: this.components.filter(c => c.productId !== productId),
      updatedAt: new Date(),
    });
  }

  public updateComponentQuantity(productId: string, quantity: number): Product {
    if (quantity <= 0) throw new Error('Cantidad debe ser mayor a 0');
    return new Product({
      ...this.toProps(),
      components: this.components.map(c => c.productId === productId ? { ...c, quantity } : c),
      updatedAt: new Date(),
    });
  }

  public setPreparationTime(minutes?: number): Product {
    if (minutes !== undefined && minutes < 0) throw new Error('Tiempo no puede ser negativo');
    return new Product({ ...this.toProps(), preparationTimeMinutes: minutes, updatedAt: new Date() });
  }

  public setCalories(calories?: number): Product {
    if (calories !== undefined && calories < 0) throw new Error('Calorías no pueden ser negativas');
    return new Product({ ...this.toProps(), calories, updatedAt: new Date() });
  }

  public addAllergen(allergen: string): Product {
    if (this.allergens.includes(allergen)) return this;
    return new Product({ ...this.toProps(), allergens: [...this.allergens, allergen], updatedAt: new Date() });
  }

  public removeAllergen(allergen: string): Product {
    return new Product({ ...this.toProps(), allergens: this.allergens.filter(a => a !== allergen), updatedAt: new Date() });
  }

  public addTag(tag: string): Product {
    if (this.tags.includes(tag)) return this;
    return new Product({ ...this.toProps(), tags: [...this.tags, tag], updatedAt: new Date() });
  }

  public removeTag(tag: string): Product {
    return new Product({ ...this.toProps(), tags: this.tags.filter(t => t !== tag), updatedAt: new Date() });
  }

  public activate(): Product {
    return new Product({ ...this.toProps(), isActive: true, status: 'active', updatedAt: new Date() });
  }

  public deactivate(): Product {
    return new Product({ ...this.toProps(), isActive: false, status: 'archived', updatedAt: new Date() });
  }

  public archive(): Product {
    return new Product({ ...this.toProps(), status: 'archived', updatedAt: new Date() });
  }

  public calculatePriceWithTax(): Money {
    return this.basePrice.multiply(1 + this.taxRate / 100);
  }

  public getMargin(): number | undefined {
    if (!this.costPrice) return undefined;
    return ((this.basePrice.amount - this.costPrice.amount) / this.basePrice.amount) * 100;
  }

  public isComposite(): boolean {
    return this.type === 'composite' || this.type === 'combo';
  }

  public canBeSold(): boolean {
    return this.isActive && this.status === 'active' && this.basePrice.amount > 0;
  }

  private toProps(): ProductProps {
    return {
      id: this.id,
      businessId: this.businessId,
      categoryId: this.categoryId,
      name: this.name,
      description: this.description,
      type: this.type,
      status: this.status,
      basePrice: this.basePrice,
      costPrice: this.costPrice,
      taxRate: this.taxRate,
      sku: this.sku,
      barcode: this.barcode,
      displayOrder: this.displayOrder,
      isActive: this.isActive,
      images: this.images,
      modifierGroupIds: this.modifierGroupIds,
      components: this.components,
      preparationTimeMinutes: this.preparationTimeMinutes,
      calories: this.calories,
      allergens: this.allergens,
      tags: this.tags,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}