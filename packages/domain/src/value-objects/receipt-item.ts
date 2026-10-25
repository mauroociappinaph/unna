import { Money } from './money';

export interface ReceiptItemProps {
  id: string;
  receiptId: string;
  productId: string;
  productName: string;
  productSku?: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  taxRate: number;
  taxAmount: Money;
  modifiers?: Array<{ modifierGroupId: string; optionId: string; name: string; priceDelta: number }>;
  createdAt: Date;
  updatedAt: Date;
}

export class ReceiptItem {
  public readonly id: string;
  public readonly receiptId: string;
  public readonly productId: string;
  public readonly productName: string;
  public readonly productSku: string | undefined;
  public readonly quantity: number;
  public readonly unitPrice: Money;
  public readonly totalPrice: Money;
  public readonly taxRate: number;
  public readonly taxAmount: Money;
  public readonly modifiers: Array<{ modifierGroupId: string; optionId: string; name: string; priceDelta: number }>;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  private constructor(props: ReceiptItemProps) {
    this.id = props.id;
    this.receiptId = props.receiptId;
    this.productId = props.productId;
    this.productName = props.productName;
    this.productSku = props.productSku;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.totalPrice = props.totalPrice;
    this.taxRate = props.taxRate;
    this.taxAmount = props.taxAmount;
    this.modifiers = props.modifiers ?? [];
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: Omit<ReceiptItemProps, 'id' | 'createdAt' | 'updatedAt'>): ReceiptItem {
    if (!props.productId) throw new Error('Product ID es obligatorio');
    if (!props.productName || !props.productName.trim()) throw new Error('Nombre de producto es obligatorio');
    if (props.quantity <= 0) throw new Error('Cantidad debe ser mayor a 0');
    if (props.unitPrice.amount < 0) throw new Error('Precio unitario no puede ser negativo');
    if (props.taxRate < 0 || props.taxRate > 100) throw new Error('Tasa de impuesto inválida');

    const now = new Date();
    return new ReceiptItem({
      ...props,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: ReceiptItemProps): ReceiptItem {
    return new ReceiptItem(props);
  }

  private toProps(): ReceiptItemProps {
    return {
      id: this.id,
      receiptId: this.receiptId,
      productId: this.productId,
      productName: this.productName,
      productSku: this.productSku,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      totalPrice: this.totalPrice,
      taxRate: this.taxRate,
      taxAmount: this.taxAmount,
      modifiers: this.modifiers,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
