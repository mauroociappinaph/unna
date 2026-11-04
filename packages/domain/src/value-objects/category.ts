export type ProductCategoryType = 'plato' | 'bebida' | 'postre' | 'extra' | 'combo';

export interface CategoryProps {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  type: ProductCategoryType;
  displayOrder: number;
  isActive: boolean;
  parentId?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Category {
  public readonly id: string;
  public readonly businessId: string;
  public readonly name: string;
  public readonly description: string | undefined;
  public readonly type: ProductCategoryType;
  public readonly displayOrder: number;
  public readonly isActive: boolean;
  public readonly parentId: string | undefined;
  public readonly imageUrl: string | undefined;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: CategoryProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.name = props.name.trim();
    this.description = props.description?.trim();
    this.type = props.type;
    this.displayOrder = props.displayOrder;
    this.isActive = props.isActive;
    this.parentId = props.parentId;
    this.imageUrl = props.imageUrl?.trim();
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: Omit<CategoryProps, 'id' | 'createdAt' | 'updatedAt'>): Category {
    if (!props.name || !props.name.trim()) {
      throw new Error('Nombre de categoría es obligatorio');
    }
    if (props.name.length > 80) {
      throw new Error('Nombre de categoría no puede exceder 80 caracteres');
    }
    if (props.description && props.description.length > 500) {
      throw new Error('Descripción no puede exceder 500 caracteres');
    }

    const validTypes: ProductCategoryType[] = ['plato', 'bebida', 'postre', 'extra', 'combo'];
    if (!validTypes.includes(props.type)) {
      throw new Error('Tipo de categoría inválido');
    }

    const now = new Date();
    return new Category({
      ...props,
      id: crypto.randomUUID(),
      name: props.name.trim(),
      description: props.description?.trim(),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: CategoryProps): Category {
    return new Category(props);
  }

  public updateName(name: string): Category {
    if (!name || !name.trim()) {
      throw new Error('Nombre de categoría es obligatorio');
    }
    return new Category({ ...this.toProps(), name: name.trim(), updatedAt: new Date() });
  }

  public updateDescription(description?: string): Category {
    if (description && description.length > 500) {
      throw new Error('Descripción no puede exceder 500 caracteres');
    }
    return new Category({ ...this.toProps(), description: description?.trim(), updatedAt: new Date() });
  }

  public updateType(type: ProductCategoryType): Category {
    const validTypes: ProductCategoryType[] = ['plato', 'bebida', 'postre', 'extra', 'combo'];
    if (!validTypes.includes(type)) {
      throw new Error('Tipo de categoría inválido');
    }
    return new Category({ ...this.toProps(), type, updatedAt: new Date() });
  }

  public updateDisplayOrder(displayOrder: number): Category {
    if (displayOrder < 0) {
      throw new Error('El orden de visualización no puede ser negativo');
    }
    return new Category({ ...this.toProps(), displayOrder, updatedAt: new Date() });
  }

  public setParent(parentId?: string): Category {
    return new Category({ ...this.toProps(), parentId, updatedAt: new Date() });
  }

  public updateImage(imageUrl?: string): Category {
    return new Category({ ...this.toProps(), imageUrl: imageUrl?.trim(), updatedAt: new Date() });
  }

  public activate(): Category {
    return new Category({ ...this.toProps(), isActive: true, updatedAt: new Date() });
  }

  public deactivate(): Category {
    return new Category({ ...this.toProps(), isActive: false, updatedAt: new Date() });
  }

  private toProps(): CategoryProps {
    return {
      id: this.id,
      businessId: this.businessId,
      name: this.name,
      description: this.description,
      type: this.type,
      displayOrder: this.displayOrder,
      isActive: this.isActive,
      parentId: this.parentId,
      imageUrl: this.imageUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}