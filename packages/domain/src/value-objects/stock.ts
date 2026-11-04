export type StockMovementType = 'in' | 'out' | 'adjustment' | 'waste' | 'transfer' | 'sale' | 'return';

export interface StockMovementProps {
  id: string;
  productId: string;
  businessId: string;
  type: StockMovementType;
  quantity: number;  // positive for in, negative for out
  reason: string;
  referenceId?: string;  // sale ID, purchase order ID, etc.
  referenceType?: string;  // 'sale' | 'purchase' | 'adjustment' | etc.
  unitCost?: number;
  totalCost?: number;
  performedBy: string;
  createdAt: Date;
}

export class StockMovement {
  public readonly id: string;
  public readonly productId: string;
  public readonly businessId: string;
  public readonly type: StockMovementType;
  public readonly quantity: number;
  public readonly reason: string;
  public readonly referenceId: string | undefined;
  public readonly referenceType: string | undefined;
  public readonly unitCost: number | undefined;
  public readonly totalCost: number | undefined;
  public readonly performedBy: string;
  public readonly createdAt: Date;

  private constructor(props: StockMovementProps) {
    this.id = props.id;
    this.productId = props.productId;
    this.businessId = props.businessId;
    this.type = props.type;
    this.quantity = props.quantity;
    this.reason = props.reason.trim();
    this.referenceId = props.referenceId;
    this.referenceType = props.referenceType;
    this.unitCost = props.unitCost;
    this.totalCost = props.totalCost;
    this.performedBy = props.performedBy;
    this.createdAt = props.createdAt;
  }

  public static create(props: Omit<StockMovementProps, 'id' | 'createdAt'>): StockMovement {
    if (!props.productId) throw new Error('Product ID es obligatorio');
    if (!props.businessId) throw new Error('Business ID es obligatorio');
    if (props.quantity === 0) throw new Error('Cantidad no puede ser cero');
    if (!props.reason || !props.reason.trim()) {
      throw new Error('Motivo es obligatorio');
    }
    if (!props.performedBy) throw new Error('Usuario que realizó el movimiento es obligatorio');

    return new StockMovement({
      ...props,
      id: crypto.randomUUID(),
      reason: props.reason.trim(),
      createdAt: new Date(),
    });
  }

  public static reconstitute(props: StockMovementProps): StockMovement {
    return new StockMovement(props);
  }

  public isIncoming(): boolean {
    return ['in', 'return', 'transfer'].includes(this.type);
  }

  public isOutgoing(): boolean {
    return ['out', 'sale', 'waste', 'transfer'].includes(this.type);
  }
}

export interface StockLevelProps {
  productId: string;
  businessId: string;
  currentQuantity: number;
  reservedQuantity: number;
  minThreshold: number;
  maxThreshold?: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastCountedAt?: Date;
  lastMovementAt?: Date;
  updatedAt: Date;
}

export interface StockCount {
  level: StockLevel;
  movement: StockMovement | null;
}

export class StockLevel {
  public readonly productId: string;
  public readonly businessId: string;
  public readonly currentQuantity: number;
  public readonly reservedQuantity: number;
  public readonly minThreshold: number;
  public readonly maxThreshold: number | undefined;
  public readonly reorderPoint: number;
  public readonly reorderQuantity: number;
  public readonly lastCountedAt: Date | undefined;
  public readonly lastMovementAt: Date | undefined;
  public readonly updatedAt: Date;

  private constructor(props: StockLevelProps) {
    this.productId = props.productId;
    this.businessId = props.businessId;
    this.currentQuantity = props.currentQuantity;
    this.reservedQuantity = props.reservedQuantity;
    this.minThreshold = props.minThreshold;
    this.maxThreshold = props.maxThreshold;
    this.reorderPoint = props.reorderPoint;
    this.reorderQuantity = props.reorderQuantity;
    this.lastCountedAt = props.lastCountedAt;
    this.lastMovementAt = props.lastMovementAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: Omit<StockLevelProps, 'updatedAt'>): StockLevel {
    if (props.currentQuantity < 0) throw new Error('Cantidad actual no puede ser negativa');
    if (props.reservedQuantity < 0) throw new Error('Cantidad reservada no puede ser negativa');
    if (props.minThreshold < 0) throw new Error('Umbral mínimo no puede ser negativo');
    if (props.maxThreshold !== undefined && props.maxThreshold < props.currentQuantity) {
      throw new Error('Máximo no puede ser menor a cantidad actual');
    }
    if (props.reorderPoint < 0) throw new Error('Punto de reorden no puede ser negativo');
    if (props.reorderQuantity <= 0) throw new Error('Cantidad de reorden debe ser positiva');

    return new StockLevel({
      ...props,
      updatedAt: new Date(),
    });
  }

  public static reconstitute(props: StockLevelProps): StockLevel {
    return new StockLevel(props);
  }

  public getAvailableQuantity(): number {
    return this.currentQuantity - this.reservedQuantity;
  }

  public isLowStock(): boolean {
    return this.getAvailableQuantity() <= this.reorderPoint;
  }

  public isOutOfStock(): boolean {
    return this.getAvailableQuantity() <= 0;
  }

  public isOverStocked(): boolean {
    if (!this.maxThreshold) return false;
    return this.currentQuantity >= this.maxThreshold;
  }

  public addStock(quantity: number, movement: StockMovement): StockLevel {
    if (quantity <= 0) throw new Error('Cantidad a agregar debe ser positiva');
    return new StockLevel({
      ...this.toProps(),
      currentQuantity: this.currentQuantity + quantity,
      lastMovementAt: movement.createdAt,
      updatedAt: new Date(),
    });
  }

  public removeStock(quantity: number, movement: StockMovement): StockLevel {
    if (quantity <= 0) throw new Error('Cantidad a remover debe ser positiva');
    const available = this.getAvailableQuantity();
    if (quantity > available) {
      throw new Error(`Stock insuficiente. Disponible: ${available}, solicitado: ${quantity}`);
    }
    return new StockLevel({
      ...this.toProps(),
      currentQuantity: this.currentQuantity - quantity,
      lastMovementAt: movement.createdAt,
      updatedAt: new Date(),
    });
  }

  public reserveStock(quantity: number): StockLevel {
    if (quantity <= 0) throw new Error('Cantidad a reservar debe ser positiva');
    const available = this.getAvailableQuantity();
    if (quantity > available) {
      throw new Error(`Stock insuficiente para reservar. Disponible: ${available}`);
    }
    return new StockLevel({
      ...this.toProps(),
      reservedQuantity: this.reservedQuantity + quantity,
      updatedAt: new Date(),
    });
  }

  public releaseReservation(quantity: number): StockLevel {
    if (quantity <= 0) throw new Error('Cantidad a liberar debe ser positiva');
    if (quantity > this.reservedQuantity) {
      throw new Error('No se puede liberar más de lo reservado');
    }
    return new StockLevel({
      ...this.toProps(),
      reservedQuantity: this.reservedQuantity - quantity,
      updatedAt: new Date(),
    });
  }

  /** The counted level and the adjustment movement for the difference; a count that matches moves nothing. */
  public recordCount(countedQuantity: number, performedBy: string): StockCount {
    if (countedQuantity < 0) throw new Error('Cantidad contada no puede ser negativa');
    const difference = countedQuantity - this.currentQuantity;
    const movement = difference === 0 ? null : StockMovement.create({
      productId: this.productId,
      businessId: this.businessId,
      type: 'adjustment',
      quantity: difference,
      reason: 'Conteo físico de inventario',
      performedBy,
    });
    const level = new StockLevel({
      ...this.toProps(),
      currentQuantity: countedQuantity,
      lastCountedAt: new Date(),
      lastMovementAt: movement?.createdAt ?? this.lastMovementAt,
      updatedAt: new Date(),
    });
    return { level, movement };
  }

  public adjustThresholds(minThreshold?: number, maxThreshold?: number, reorderPoint?: number, reorderQuantity?: number): StockLevel {
    return new StockLevel({
      ...this.toProps(),
      minThreshold: minThreshold ?? this.minThreshold,
      maxThreshold: maxThreshold ?? this.maxThreshold,
      reorderPoint: reorderPoint ?? this.reorderPoint,
      reorderQuantity: reorderQuantity ?? this.reorderQuantity,
      updatedAt: new Date(),
    });
  }

  private toProps(): StockLevelProps {
    return {
      productId: this.productId,
      businessId: this.businessId,
      currentQuantity: this.currentQuantity,
      reservedQuantity: this.reservedQuantity,
      minThreshold: this.minThreshold,
      maxThreshold: this.maxThreshold,
      reorderPoint: this.reorderPoint,
      reorderQuantity: this.reorderQuantity,
      lastCountedAt: this.lastCountedAt,
      lastMovementAt: this.lastMovementAt,
      updatedAt: this.updatedAt,
    };
  }
}