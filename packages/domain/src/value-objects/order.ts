import { Money } from './money';
import { Address } from './address';
import { OrderItem, type OrderItemProps } from './order-item';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled' | 'refunded';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'pickup';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'mercado_pago' | 'transfer' | 'qr' | 'split';
export type ReceiptType = 'A' | 'B' | 'C' | 'ticket' | 'proforma';

/** Statuses after which an order is no longer worked on; the POS lists only the other ones as open (S17). */
export const CLOSED_ORDER_STATUSES: readonly OrderStatus[] = ['delivered', 'cancelled', 'refunded'];

export function isOrderClosed(status: OrderStatus): boolean {
  return CLOSED_ORDER_STATUSES.includes(status);
}

export { OrderItem, type OrderItemProps };

export interface OrderProps {
  id: string;
  businessId: string;
  sucursalId: string;
  orderNumber: string;           // human-readable number (e.g., "0001-00001")
  type: OrderType;
  status: OrderStatus;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: Address;
  items: OrderItem[];
  subtotal: Money;
  taxAmount: Money;
  discountAmount: Money;
  totalAmount: Money;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  notes?: string;
  sucursalName: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledReason?: string;
}

export class Order {
  public readonly id: string;
  public readonly businessId: string;
  public readonly sucursalId: string;
  public readonly orderNumber: string;
  public readonly type: OrderType;
  public readonly status: OrderStatus;
  public readonly tableNumber: string | undefined;
  public readonly customerName: string | undefined;
  public readonly customerPhone: string | undefined;
  public readonly customerEmail: string | undefined;
  public readonly deliveryAddress: Address | undefined;
  public readonly items: OrderItem[];
  public readonly subtotal: Money;
  public readonly taxAmount: Money;
  public readonly discountAmount: Money;
  public readonly totalAmount: Money;
  public readonly paymentStatus: PaymentStatus;
  public readonly paymentMethod: PaymentMethod | undefined;
  public readonly paymentReference: string | undefined;
  public readonly notes: string | undefined;
  public readonly sucursalName: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly completedAt: Date | undefined;
  public readonly cancelledAt: Date | undefined;
  public readonly cancelledReason: string | undefined;

  private constructor(props: OrderProps) {
    this.id = props.id;
    this.businessId = props.businessId;
    this.sucursalId = props.sucursalId;
    this.orderNumber = props.orderNumber;
    this.type = props.type;
    this.status = props.status;
    this.tableNumber = props.tableNumber;
    this.customerName = props.customerName;
    this.customerPhone = props.customerPhone;
    this.customerEmail = props.customerEmail;
    this.deliveryAddress = props.deliveryAddress;
    this.items = props.items;
    this.subtotal = props.subtotal;
    this.taxAmount = props.taxAmount;
    this.discountAmount = props.discountAmount;
    this.totalAmount = props.totalAmount;
    this.paymentStatus = props.paymentStatus;
    this.paymentMethod = props.paymentMethod;
    this.paymentReference = props.paymentReference;
    this.notes = props.notes;
    this.sucursalName = props.sucursalName;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.completedAt = props.completedAt;
    this.cancelledAt = props.cancelledAt;
    this.cancelledReason = props.cancelledReason;
  }

  /** Status, order number, totals and each item's orderId are set here, never by the caller. */
  public static create(props: Omit<OrderProps, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber' | 'status' | 'subtotal' | 'taxAmount' | 'discountAmount' | 'totalAmount' | 'paymentStatus' | 'items'> & { items: Array<Omit<OrderItemProps, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>> }): Order {
    if (!props.businessId) throw new Error('Business ID es obligatorio');
    if (!props.sucursalId) throw new Error('Sucursal ID es obligatorio');
    if (!props.sucursalName || !props.sucursalName.trim()) throw new Error('Nombre de sucursal es obligatorio');
    if (!props.items || props.items.length === 0) throw new Error('El pedido debe tener al menos un item');

    const now = new Date();
    const orderId = crypto.randomUUID();
    const items = props.items.map(item => OrderItem.create({
      ...item,
      orderId,
    }));

    const subtotal = items.reduce((sum, item) => sum.add(item.totalPrice), Money.zero('ARS'));
    const taxAmount = items.reduce((sum, item) => sum.add(item.taxAmount), Money.zero('ARS'));
    const discountAmount = Money.zero('ARS');
    const totalAmount = subtotal.add(taxAmount).subtract(discountAmount);

    // Generate order number: YYMMDD-XXXXX
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const orderNumber = `${dateStr}-${randomSuffix}`;

    return new Order({
      ...props,
      id: orderId,
      orderNumber,
      status: 'pending',
      paymentStatus: 'pending',
      items,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  public addItem(itemData: Omit<OrderItemProps, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>): Order {
    const newItem = OrderItem.create({ ...itemData, orderId: this.id });
    const newItems = [...this.items, newItem];
    return this.recalculate(newItems);
  }

  public removeItem(itemId: string): Order {
    const newItems = this.items.filter(item => item.id !== itemId);
    if (newItems.length === 0) throw new Error('El pedido debe tener al menos un item');
    return this.recalculate(newItems);
  }

  public updateItemQuantity(itemId: string, quantity: number): Order {
    const newItems = this.items.map(item => 
      item.id === itemId ? item.updateQuantity(quantity) : item
    );
    return this.recalculate(newItems);
  }

  public applyDiscount(amount: Money): Order {
    if (amount.amount > this.subtotal.amount) {
      throw new Error('El descuento no puede ser mayor al subtotal');
    }
    return new Order({
      ...this.toProps(),
      discountAmount: amount,
      totalAmount: this.subtotal.add(this.taxAmount).subtract(amount),
      updatedAt: new Date(),
    });
  }

  public removeDiscount(): Order {
    return new Order({
      ...this.toProps(),
      discountAmount: Money.zero('ARS'),
      totalAmount: this.subtotal.add(this.taxAmount),
      updatedAt: new Date(),
    });
  }

  public confirm(): Order {
    if (this.status !== 'pending') throw new Error('Solo pedidos pendientes pueden confirmarse');
    return new Order({
      ...this.toProps(),
      status: 'confirmed',
      updatedAt: new Date(),
    });
  }

  public startPreparing(): Order {
    if (this.status !== 'confirmed') throw new Error('Solo pedidos confirmados pueden prepararse');
    return new Order({
      ...this.toProps(),
      status: 'preparing',
      updatedAt: new Date(),
    });
  }

  public markReady(): Order {
    if (this.status !== 'preparing') throw new Error('Solo pedidos en preparación pueden marcarse como listos');
    return new Order({
      ...this.toProps(),
      status: 'ready',
      updatedAt: new Date(),
    });
  }

  public deliver(): Order {
    if (this.status !== 'ready') throw new Error('Solo pedidos listos pueden entregarse');
    return new Order({
      ...this.toProps(),
      status: 'delivered',
      completedAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public cancel(reason: string): Order {
    if (['delivered', 'cancelled', 'refunded'].includes(this.status)) {
      throw new Error('No se puede cancelar un pedido en este estado');
    }
    return new Order({
      ...this.toProps(),
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledReason: reason,
      updatedAt: new Date(),
    });
  }

  public markPaymentCompleted(method: PaymentMethod, reference?: string): Order {
    if (this.paymentStatus === 'completed') throw new Error('El pago ya está completado');
    return new Order({
      ...this.toProps(),
      paymentStatus: 'completed',
      paymentMethod: method,
      paymentReference: reference,
      updatedAt: new Date(),
    });
  }

  public refund(): Order {
    if (this.paymentStatus !== 'completed') throw new Error('Solo pedidos pagados pueden reembolsarse');
    if (this.status === 'refunded') throw new Error('El pedido ya está reembolsado');
    return new Order({
      ...this.toProps(),
      status: 'refunded',
      paymentStatus: 'refunded',
      updatedAt: new Date(),
    });
  }

  public canBeModified(): boolean {
    return ['pending', 'confirmed'].includes(this.status);
  }

  public canBeCancelled(): boolean {
    return !['delivered', 'cancelled', 'refunded'].includes(this.status);
  }

  public getItemCount(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  private recalculate(items: OrderItem[]): Order {
    const subtotal = items.reduce((sum, item) => sum.add(item.totalPrice), Money.zero('ARS'));
    const taxAmount = items.reduce((sum, item) => sum.add(item.taxAmount), Money.zero('ARS'));
    const totalAmount = subtotal.add(taxAmount).subtract(this.discountAmount);
    return new Order({
      ...this.toProps(),
      items,
      subtotal,
      taxAmount,
      totalAmount,
      updatedAt: new Date(),
    });
  }

  private toProps(): OrderProps {
    return {
      id: this.id,
      businessId: this.businessId,
      sucursalId: this.sucursalId,
      orderNumber: this.orderNumber,
      type: this.type,
      status: this.status,
      tableNumber: this.tableNumber,
      customerName: this.customerName,
      customerPhone: this.customerPhone,
      customerEmail: this.customerEmail,
      deliveryAddress: this.deliveryAddress,
      items: this.items,
      subtotal: this.subtotal,
      taxAmount: this.taxAmount,
      discountAmount: this.discountAmount,
      totalAmount: this.totalAmount,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      paymentReference: this.paymentReference,
      notes: this.notes,
      sucursalName: this.sucursalName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
      cancelledAt: this.cancelledAt,
      cancelledReason: this.cancelledReason,
    };
  }
}