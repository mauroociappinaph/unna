import { Money } from './money';

export interface OrderItemProps {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: Money;           // price at time of order
  totalPrice: Money;          // unitPrice * quantity
  taxRate: number;            // percentage
  taxAmount: Money;
  notes?: string;
  modifiers: Array<{ modifierGroupId: string; optionId: string; name: string; priceDelta: number }>;
  createdAt: Date;
  updatedAt: Date;
}

export class OrderItem {
  public readonly id: string;
  public readonly orderId: string;
  public readonly productId: string;
  public readonly productName: string;
  public readonly productSku: string | undefined;
  public readonly quantity: number;
  public readonly unitPrice: Money;
  public readonly totalPrice: Money;
  public readonly taxRate: number;
  public readonly taxAmount: Money;
  public readonly notes: string | undefined;
  public readonly modifiers: Array<{ modifierGroupId: string; optionId: string; name: string; priceDelta: number }>;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: OrderItemProps) {
    this.id = props.id;
    this.orderId = props.orderId;
    this.productId = props.productId;
    this.productName = props.productName;
    this.productSku = props.productSku;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.totalPrice = props.totalPrice;
    this.taxRate = props.taxRate;
    this.taxAmount = props.taxAmount;
    this.notes = props.notes;
    this.modifiers = props.modifiers ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: Omit<OrderItemProps, 'id' | 'createdAt' | 'updatedAt'>): OrderItem {
    if (!props.productId) throw new Error('Product ID es obligatorio');
    if (!props.productName || !props.productName.trim()) throw new Error('Nombre de producto es obligatorio');
    if (props.quantity <= 0) throw new Error('Cantidad debe ser mayor a 0');
    if (props.unitPrice.amount < 0) throw new Error('Precio unitario no puede ser negativo');
    if (props.taxRate < 0 || props.taxRate > 100) throw new Error('Tasa de impuesto inválida');

    const now = new Date();
    return new OrderItem({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: OrderItemProps): OrderItem {
    return new OrderItem(props);
  }

  public updateQuantity(quantity: number): OrderItem {
    if (quantity <= 0) throw new Error('Cantidad debe ser mayor a 0');
    return new OrderItem({
      ...this.toProps(),
      quantity,
      totalPrice: this.unitPrice.multiply(quantity),
      taxAmount: this.unitPrice.multiply(quantity).percentage(this.taxRate),
      updatedAt: new Date(),
    });
  }

  public addModifier(modifier: { modifierGroupId: string; optionId: string; name: string; priceDelta: number }): OrderItem {
    return this.repriced(this.unitPrice.amount + modifier.priceDelta, [...this.modifiers, modifier]);
  }

  public removeModifier(optionId: string): OrderItem {
    const modifier = this.modifiers.find(m => m.optionId === optionId);
    if (!modifier) return this;
    return this.repriced(this.unitPrice.amount - modifier.priceDelta, this.modifiers.filter(m => m.optionId !== optionId));
  }

  // Deltas can be negative ("sin X" options), so prices are recomputed from the unit price in cents.
  private repriced(unitCents: number, modifiers: OrderItemProps['modifiers']): OrderItem {
    if (unitCents < 0) throw new Error('El precio con modificadores no puede ser negativo');
    const unitPrice = Money.fromCents(unitCents, this.unitPrice.currency);
    const totalPrice = unitPrice.multiply(this.quantity);
    return new OrderItem({
      ...this.toProps(),
      modifiers,
      unitPrice,
      totalPrice,
      taxAmount: totalPrice.percentage(this.taxRate),
      updatedAt: new Date(),
    });
  }

  private toProps(): OrderItemProps {
    return {
      id: this.id,
      orderId: this.orderId,
      productId: this.productId,
      productName: this.productName,
      productSku: this.productSku,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      totalPrice: this.totalPrice,
      taxRate: this.taxRate,
      taxAmount: this.taxAmount,
      notes: this.notes,
      modifiers: this.modifiers,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
