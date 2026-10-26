import { Inject, Injectable } from '@nestjs/common';
import {
  NotFoundError,
  BusinessRepositoryPort,
  CashSessionRepositoryPort,
  LockedOrderRepositories,
  ModifierGroupRepositoryPort,
  OrderListFilters,
  OrderRepositoryPort,
  OrderSummary,
  Page,
  PageRequest,
  PaymentRecord,
  PaymentRepositoryPort,
  ProductRepositoryPort,
  SalesUnitOfWorkPort,
  Money,
  Order,
} from '@unna/domain';
import { NewOrderLine, OrderLineCatalog, OrderLineInput, priceOrderLine } from './order-line-pricing';
import { registerOrderPayment } from './order-payment';

export type { OrderLineInput };
import { pageOrInvalidCursor } from './page-result';

export const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery', 'pickup'] as const;
export const PAYMENT_METHODS = ['cash', 'card', 'mercado_pago', 'transfer', 'qr'] as const;
const MAX_ORDER_NUMBER_ATTEMPTS = 5;

/** A random order number taken by another order of the business (unique violation). */
export function isOrderNumberCollision(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: string[] | string } };
  return e?.code === 'P2002' && String(e.meta?.target ?? '').includes('orderNumber');
}

export const ORDER_ACTIONS = ['confirm', 'prepare', 'ready', 'deliver', 'cancel'] as const;

interface Result<T> {
  ok: boolean;
  value?: T;
  error?: Error;
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(message: string): Result<T> => ({ ok: false, error: new Error(message) });
const notFound = <T>(message: string): Result<T> => ({ ok: false, error: new NotFoundError(message) });

const isOneOf = <T extends string>(values: readonly T[], value: string): value is T =>
  (values as readonly string[]).includes(value);

@Injectable()
export class SalesUseCase {
  constructor(
    @Inject('OrderRepositoryPort') private readonly orders: OrderRepositoryPort,
    @Inject('PaymentRepositoryPort') private readonly payments: PaymentRepositoryPort,
    @Inject('ProductRepositoryPort') private readonly products: ProductRepositoryPort,
    @Inject('ModifierGroupRepositoryPort') private readonly modifierGroups: ModifierGroupRepositoryPort,
    @Inject('BusinessRepositoryPort') private readonly businesses: BusinessRepositoryPort,
    @Inject('SalesUnitOfWorkPort') private readonly unitOfWork: SalesUnitOfWorkPort,
    @Inject('CashSessionRepositoryPort') private readonly cashSessions: CashSessionRepositoryPort,
  ) {}

  async createOrder(command: {
    businessId: string;
    sucursalId: string;
    type: string;
    items: OrderLineInput[];
    tableNumber?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    notes?: string;
  }): Promise<Result<Order>> {
    if (!isOneOf(ORDER_TYPES, command.type)) return fail('Tipo de pedido inválido');
    if (!command.items?.length) return fail('El pedido debe tener al menos un item');

    const business = await this.businesses.findById(command.businessId);
    if (!business) return notFound('Negocio no encontrado');
    const sucursal = business.sucursales.find((s) => s.id === command.sucursalId && s.isActive);
    if (!sucursal) return notFound('Sucursal no encontrada');
    if (!(await this.cashSessions.findOpenBySucursal(command.businessId, sucursal.id))) {
      return fail('Abrí la caja para empezar a vender');
    }

    const lines: NewOrderLine[] = [];
    for (const line of command.items) {
      const built = await priceOrderLine(this.catalog(), command.businessId, line);
      if (!built.ok) return fail(built.error!.message);
      lines.push(built.value!);
    }

    const props: Parameters<typeof Order.create>[0] = {
      businessId: command.businessId,
      sucursalId: sucursal.id,
      sucursalName: sucursal.name,
      type: command.type,
      tableNumber: command.tableNumber,
      customerName: command.customerName,
      customerPhone: command.customerPhone,
      customerEmail: command.customerEmail,
      notes: command.notes,
      items: lines,
    };

    // Order numbers are random per day; on a collision within the business, draw a new one.
    for (let attempt = 1; ; attempt++) {
      const order = Order.create(props);
      try {
        await this.orders.save(order);
        return ok(order);
      } catch (error) {
        if (attempt >= MAX_ORDER_NUMBER_ATTEMPTS || !isOrderNumberCollision(error)) throw error;
      }
    }
  }

  // Each change below reads, checks and saves under the order's lock, so it cannot slip past a
  // concurrent payment: once a payment commits, the change sees it and is rejected.
  async addItem(command: { businessId: string; orderId: string; line: OrderLineInput }): Promise<Result<Order>> {
    return this.unitOfWork.withOrderLock(command.orderId, command.businessId, async (repositories) => {
      const order = await this.findModifiable(repositories, command.businessId, command.orderId);
      if (!order.ok) return order;
      const built = await priceOrderLine(this.catalog(), command.businessId, command.line);
      if (!built.ok) return fail<Order>(built.error!.message);
      const updated = order.value!.addItem(built.value!);
      await repositories.orders.save(updated);
      return ok(updated);
    });
  }

  async removeItem(command: { businessId: string; orderId: string; itemId: string }): Promise<Result<Order>> {
    return this.unitOfWork.withOrderLock(command.orderId, command.businessId, async (repositories) => {
      const order = await this.findModifiable(repositories, command.businessId, command.orderId);
      if (!order.ok) return order;
      if (!order.value!.items.some((i) => i.id === command.itemId)) return notFound<Order>('Item no encontrado');
      const updated = order.value!.removeItem(command.itemId);
      await repositories.orders.save(updated);
      return ok(updated);
    });
  }

  async applyDiscount(command: { businessId: string; orderId: string; amount: number }): Promise<Result<Order>> {
    return this.unitOfWork.withOrderLock(command.orderId, command.businessId, async (repositories) => {
      const order = await this.findModifiable(repositories, command.businessId, command.orderId);
      if (!order.ok) return order;
      const updated =
        command.amount === 0 ? order.value!.removeDiscount() : order.value!.applyDiscount(Money.fromCents(command.amount));
      await repositories.orders.save(updated);
      return ok(updated);
    });
  }

  async changeStatus(command: { businessId: string; orderId: string; action: string; reason?: string }): Promise<Result<Order>> {
    return this.unitOfWork.withOrderLock(command.orderId, command.businessId, async ({ orders, payments }) => {
      const order = await orders.findByIdAndBusinessId(command.orderId, command.businessId);
      if (!order) return notFound<Order>('Pedido no encontrado');

      let updated: Order;
      switch (command.action) {
        case 'confirm':
          updated = order.confirm();
          break;
        case 'prepare':
          updated = order.startPreparing();
          break;
        case 'ready':
          updated = order.markReady();
          break;
        case 'deliver':
          updated = order.deliver();
          break;
        case 'cancel':
          if (!command.reason?.trim()) return fail<Order>('El motivo de cancelación es obligatorio');
          if (order.paymentStatus === 'completed') {
            return fail<Order>('El pedido ya está pagado; corresponde un reembolso, no una cancelación');
          }
          if ((await payments.findByOrderId(order.id)).some((p) => p.status === 'completed')) {
            return fail<Order>('El pedido tiene pagos registrados; corresponde un reembolso, no una cancelación');
          }
          updated = order.cancel(command.reason.trim());
          break;
        default:
          return fail<Order>('Acción inválida');
      }

      await orders.save(updated);
      return ok(updated);
    });
  }

  async registerPayment(command: {
    businessId: string;
    orderId: string;
    amount: number;
    method: string;
    reference?: string;
  }): Promise<Result<{ order: Order; payments: PaymentRecord[]; remaining: number }>> {
    const { method } = command;
    if (!isOneOf(PAYMENT_METHODS, method)) return fail('Método de pago inválido');
    if (!Number.isInteger(command.amount) || command.amount <= 0) return fail('El monto debe ser un entero positivo en centavos');

    // The balance check and the writes run under the order's lock (see registerOrderPayment).
    return this.unitOfWork.withOrderLock(command.orderId, command.businessId, async (repositories) => {
      const result = await registerOrderPayment(repositories, { ...command, method });
      if (!result.ok) return { ok: false, error: result.error };
      const { order, payments, remaining } = result.value!;
      return ok({ order, payments, remaining });
    });
  }

  async listPayments(command: { businessId: string; orderId: string }): Promise<Result<PaymentRecord[]>> {
    const order = await this.orders.findByIdAndBusinessId(command.orderId, command.businessId);
    if (!order) return notFound('Pedido no encontrado');
    return ok(await this.payments.findByOrderId(order.id));
  }

  /** Reads the order through the lock-bound repositories and checks it still accepts changes. */
  async getOrder(businessId: string, orderId: string): Promise<Result<Order>> {
    const order = await this.orders.findByIdAndBusinessId(orderId, businessId);
    return order ? ok(order) : notFound('Pedido no encontrado');
  }

  /** Newest first, without the items (each order carries its itemCount). */
  async listOrders(businessId: string, filters: OrderListFilters, page: PageRequest): Promise<Result<Page<OrderSummary>>> {
    return pageOrInvalidCursor(await this.orders.findPageByBusinessId(businessId, filters, page));
  }

  private async findModifiable(
    { orders, payments }: LockedOrderRepositories,
    businessId: string,
    orderId: string,
  ): Promise<Result<Order>> {
    const order = await orders.findByIdAndBusinessId(orderId, businessId);
    if (!order) return notFound('Pedido no encontrado');
    if (!order.canBeModified() || order.paymentStatus !== 'pending') {
      return fail('El pedido ya no se puede modificar');
    }
    // A partial payment keeps paymentStatus 'pending', so check the payments themselves.
    if ((await payments.findByOrderId(order.id)).some((p) => p.status === 'completed')) {
      return fail('El pedido tiene pagos registrados y ya no se puede modificar');
    }
    return ok(order);
  }

  /** Prices, tax and names come from the catalog, never from the client (see priceOrderLine). */
  private catalog(): OrderLineCatalog {
    return { products: this.products, modifierGroups: this.modifierGroups };
  }
}
