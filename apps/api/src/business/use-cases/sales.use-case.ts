import { Inject, Injectable } from '@nestjs/common';
import {
  NotFoundError,
  BusinessRepositoryPort,
  CashSessionRepositoryPort,
  LockedOrderRepositories,
  ModifierGroupRepositoryPort,
  OrderListFilters,
  OrderRepositoryPort,
  PaymentRecord,
  PaymentRepositoryPort,
  ProductRepositoryPort,
  SalesUnitOfWorkPort,
  Money,
  Order,
} from '@unna/domain';

export const ORDER_TYPES = ['dine_in', 'takeaway', 'delivery', 'pickup'] as const;
export const PAYMENT_METHODS = ['cash', 'card', 'mercado_pago', 'transfer', 'qr'] as const;
const MAX_ORDER_NUMBER_ATTEMPTS = 5;

function isOrderNumberCollision(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: string[] | string } };
  return e?.code === 'P2002' && String(e.meta?.target ?? '').includes('orderNumber');
}

export const ORDER_ACTIONS = ['confirm', 'prepare', 'ready', 'deliver', 'cancel'] as const;

export interface OrderLineInput {
  productId: string;
  quantity: number;
  notes?: string;
  modifiers?: Array<{ modifierGroupId: string; optionId: string }>;
}

interface Result<T> {
  ok: boolean;
  value?: T;
  error?: Error;
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(message: string): Result<T> => ({ ok: false, error: new Error(message) });
const notFound = <T>(message: string): Result<T> => ({ ok: false, error: new NotFoundError(message) });

const formatCents = (cents: number) => Money.fromCents(cents).format();

const isOneOf = <T extends string>(values: readonly T[], value: string): value is T =>
  (values as readonly string[]).includes(value);

/** A priced order line; the order assigns its own id to it. */
type NewOrderLine = Parameters<Order['addItem']>[0];

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
      const built = await this.buildLine(command.businessId, line);
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
      const built = await this.buildLine(command.businessId, command.line);
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

    // The balance check and both writes run under the order's lock: concurrent payments queue up
    // and each one sees the payments committed before it, so the total cannot be exceeded.
    // The cash session is read with a shared lock in the same transaction, so it cannot be closed
    // until this payment, linked to it, commits.
    return this.unitOfWork.withOrderLock(command.orderId, command.businessId, async ({ orders, payments, cashSessions }) => {
      const order = await orders.findByIdAndBusinessId(command.orderId, command.businessId);
      if (!order) return notFound('Pedido no encontrado');
      if (['cancelled', 'refunded'].includes(order.status)) return fail('No se puede cobrar un pedido cancelado o reembolsado');
      if (order.paymentStatus === 'completed') return fail('El pedido ya está pagado');
      const cashSession = await cashSessions.findOpenBySucursalForPayment(command.businessId, order.sucursalId);
      if (!cashSession) return fail('Abrí la caja para cobrar');

      const previous = (await payments.findByOrderId(order.id)).filter((p) => p.status === 'completed');
      const paid = previous.reduce((sum, p) => sum + p.amount, 0);
      const remaining = order.totalAmount.toCents() - paid;
      if (command.amount > remaining) {
        return fail(`El monto supera el saldo pendiente (${formatCents(remaining)})`);
      }

      const now = new Date();
      const payment: PaymentRecord = {
        id: crypto.randomUUID(),
        orderId: order.id,
        businessId: command.businessId,
        amount: command.amount,
        method,
        status: 'completed',
        reference: command.reference,
        processedAt: now,
        cashSessionId: cashSession.id,
        createdAt: now,
      };
      await payments.save(payment);

      const all = [...previous, payment];
      const newRemaining = remaining - command.amount;
      let updated = order;
      if (newRemaining === 0) {
        const methods = new Set(all.map((p) => p.method));
        updated = order.markPaymentCompleted(methods.size === 1 ? method : 'split', command.reference);
        await orders.save(updated);
      }

      return ok({ order: updated, payments: all, remaining: newRemaining });
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

  async listOrders(businessId: string, filters: OrderListFilters): Promise<Result<Order[]>> {
    return ok(await this.orders.findByBusinessId(businessId, filters));
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

  /** Prices, tax and names come from the catalog, never from the client. */
  private async buildLine(businessId: string, line: OrderLineInput): Promise<Result<NewOrderLine>> {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return fail<NewOrderLine>('La cantidad debe ser un entero positivo');
    }
    const product = await this.products.findByIdAndBusinessId(line.productId, businessId);
    if (!product) return notFound<NewOrderLine>(`Producto ${line.productId} no encontrado`);
    if (!product.canBeSold()) return fail<NewOrderLine>(`El producto "${product.name}" no está disponible para la venta`);

    const groups = await Promise.all(
      product.modifierGroupIds.map((id) => this.modifierGroups.findByIdAndBusinessId(id, businessId)),
    );
    const selected = line.modifiers ?? [];
    const modifiers: Array<{ modifierGroupId: string; optionId: string; name: string; priceDelta: number }> = [];

    for (const choice of selected) {
      const group = groups.find((g) => g?.id === choice.modifierGroupId && g.isActive);
      if (!group) return fail<NewOrderLine>(`El modificador ${choice.modifierGroupId} no aplica a "${product.name}"`);
      const option = group.options.find((o) => o.id === choice.optionId && o.isActive);
      if (!option) return notFound<NewOrderLine>(`Opción ${choice.optionId} no encontrada en "${group.name}"`);
      modifiers.push({ modifierGroupId: group.id, optionId: option.id, name: option.name, priceDelta: option.priceDelta });
    }

    for (const group of groups) {
      if (!group || !group.isActive) continue;
      const count = modifiers.filter((m) => m.modifierGroupId === group.id).length;
      const min = group.isRequired ? Math.max(1, group.minSelection) : group.minSelection;
      if (count < min) return fail<NewOrderLine>(`Elegí al menos ${min} opción(es) de "${group.name}"`);
      if (group.maxSelection > 0 && count > group.maxSelection) {
        return fail<NewOrderLine>(`Podés elegir hasta ${group.maxSelection} opción(es) de "${group.name}"`);
      }
    }

    // Deltas can be negative ("sin X" options), so add them in cents and validate only the final price.
    const unitCents = modifiers.reduce((sum, m) => sum + m.priceDelta, product.basePrice.amount);
    if (unitCents < 0) return fail<NewOrderLine>(`El precio de "${product.name}" con sus modificadores no puede ser negativo`);
    const unitPrice = Money.fromCents(unitCents, product.basePrice.currency);
    const totalPrice = unitPrice.multiply(line.quantity);
    return ok({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      quantity: line.quantity,
      unitPrice,
      totalPrice,
      taxRate: product.taxRate,
      taxAmount: totalPrice.percentage(product.taxRate),
      notes: line.notes,
      modifiers,
    });
  }
}
