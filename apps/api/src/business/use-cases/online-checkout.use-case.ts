import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  MercadoPagoGatewayPort,
  MercadoPagoOrderItem,
  ModifierGroupRepositoryPort,
  OnlineCheckoutLine,
  OnlineCheckoutRecord,
  OnlineCheckoutRepositoryPort,
  onlineCheckoutExternalReference,
  Order,
  PREORDER_CHECKOUT_EXPIRATION,
  PREORDER_CHECKOUT_TTL_MS,
  PREORDER_CUSTOMER_NAME_MAX,
  PREORDER_MAX_LINES,
  PREORDER_MAX_QUANTITY,
  PREORDER_NOT_RECEIVING,
  PreorderLocal,
  ProductRepositoryPort,
} from '@unna/domain';
import { UseCaseResult } from '../../common/use-case-result';
import { MercadoPagoAccessTokenProvider } from './mercadopago-access-token.provider';
import { stableIdempotencyKey } from './mercadopago-idempotency-key';
import { NewOrderLine, OrderLineCatalog, OrderLineInput, priceOrderLine } from './order-line-pricing';
import { PreorderLocalLookup } from './preorder-local-lookup';
import { preorderTrackingUrl } from './preorder-urls';

export const PRODUCT_UNAVAILABLE = 'Algún producto ya no está disponible';
const INVALID_NAME = `Ingresá tu nombre (hasta ${PREORDER_CUSTOMER_NAME_MAX} caracteres)`;
const INVALID_LINES = `El pedido debe tener de 1 a ${PREORDER_MAX_LINES} productos`;
const INVALID_QUANTITY = `La cantidad de cada producto debe ser de 1 a ${PREORDER_MAX_QUANTITY}`;
const PAYMENT_NOT_STARTED = 'No se pudo iniciar el pago con Mercado Pago. Probá de nuevo';

export interface PreorderCart {
  customerName: string;
  items: OrderLineInput[];
}

export interface CreatedCheckout {
  /** Secret of the tracking page; only its hash is stored. */
  trackingToken: string;
  checkoutUrl: string;
  /** Integer cents. */
  total: number;
}

const fail = <T>(message: string): UseCaseResult<T> => ({ ok: false, error: new Error(message) });

/** Only the SHA-256 of a tracking token is stored; lookups hash the presented token. */
export const hashTrackingToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/**
 * Checkout of the pedido anticipado (S20): validates the cart with server prices, stores it awaiting
 * payment and creates the Mercado Pago online order (Checkout Pro) outside any transaction. No UNNA
 * order exists until the payment is approved (OnlineCheckoutSync), so the POS and the bar never see
 * unpaid orders.
 */
@Injectable()
export class OnlineCheckoutUseCase {
  constructor(
    private readonly locals: PreorderLocalLookup,
    @Inject('ProductRepositoryPort') private readonly products: Pick<ProductRepositoryPort, 'findByIdAndBusinessId'>,
    @Inject('ModifierGroupRepositoryPort') private readonly modifierGroups: Pick<ModifierGroupRepositoryPort, 'findByIdAndBusinessId'>,
    @Inject('OnlineCheckoutRepositoryPort') private readonly checkouts: OnlineCheckoutRepositoryPort,
    @Inject('MercadoPagoGatewayPort') private readonly gateway: MercadoPagoGatewayPort,
    private readonly tokens: MercadoPagoAccessTokenProvider,
  ) {}

  async create(slug: string, cart: PreorderCart, now = new Date()): Promise<UseCaseResult<CreatedCheckout>> {
    const found = await this.locals.find(slug);
    if (!found.ok) return { ok: false, error: found.error };
    const local = found.value!;
    const reason = await this.locals.notAcceptingReason(local, now);
    if (reason) return fail(reason);

    const customerName = typeof cart.customerName === 'string' ? cart.customerName.trim() : '';
    if (customerName.length < 1 || customerName.length > PREORDER_CUSTOMER_NAME_MAX) return fail(INVALID_NAME);
    const items = Array.isArray(cart.items) ? cart.items : [];
    if (items.length < 1 || items.length > PREORDER_MAX_LINES) return fail(INVALID_LINES);
    if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > PREORDER_MAX_QUANTITY)) return fail(INVALID_QUANTITY);

    const priced = await this.priceLines(local, items);
    if (!priced.ok) return { ok: false, error: priced.error };
    const { lines, total } = priced.value!;

    const token = await this.tokens.validAccessToken(local.businessId, now);
    if (!token.ok) return fail(PREORDER_NOT_RECEIVING);

    const trackingToken = randomBytes(32).toString('base64url');
    const checkout: OnlineCheckoutRecord = {
      id: randomUUID(), businessId: local.businessId, sucursalId: local.id, sucursalName: local.name, trackingTokenHash: hashTrackingToken(trackingToken),
      status: 'awaiting_payment', customerName, lines, total, mpOrderId: null, checkoutUrl: null,
      expiresAt: new Date(now.getTime() + PREORDER_CHECKOUT_TTL_MS), paidAt: null, orderId: null, paymentId: null, mpPaymentId: null,
      paymentError: null, createdAt: now, updatedAt: now,
    };
    await this.checkouts.create(checkout);
    return this.startPayment(token.value as string, checkout, trackingToken);
  }

  /** Prices every line from the catalog; the total is the one of the order it becomes. */
  private async priceLines(local: PreorderLocal, items: OrderLineInput[]): Promise<UseCaseResult<{ lines: OnlineCheckoutLine[]; total: number }>> {
    const catalog: OrderLineCatalog = { products: this.products, modifierGroups: this.modifierGroups };
    const priced: Array<{ line: NewOrderLine; preparationTimeMinutes: number | null }> = [];
    for (const item of items) {
      const result = await priceOrderLine(catalog, local.businessId, item);
      if (!result.ok) return fail(result.unavailable ? PRODUCT_UNAVAILABLE : result.error!.message);
      priced.push({ line: result.value!, preparationTimeMinutes: result.preparationTimeMinutes ?? null });
    }
    const draft = Order.create({ businessId: local.businessId, sucursalId: local.id, sucursalName: local.name, type: 'pickup', items: priced.map((p) => p.line) });
    const lines = priced.map(({ line, preparationTimeMinutes }) => ({
      productId: line.productId,
      productName: line.productName,
      productSku: line.productSku ?? null,
      quantity: line.quantity,
      unitPrice: line.unitPrice.toCents(),
      totalPrice: line.totalPrice.toCents(),
      taxRate: line.taxRate,
      taxAmount: line.taxAmount.toCents(),
      notes: line.notes ?? null,
      modifiers: line.modifiers,
      preparationTimeMinutes,
    }));
    return { ok: true, value: { lines, total: draft.totalAmount.toCents() } };
  }

  /** Without any lock or transaction (S18). A failure cancels the checkout, which nobody can pay. */
  private async startPayment(accessToken: string, checkout: OnlineCheckoutRecord, trackingToken: string): Promise<UseCaseResult<CreatedCheckout>> {
    const backUrl = preorderTrackingUrl(trackingToken);
    let order: { id: string; checkoutUrl: string };
    try {
      order = await this.gateway.createOnlineOrder(accessToken, {
        externalReference: onlineCheckoutExternalReference(checkout.id),
        amount: checkout.total,
        items: mercadoPagoItems(checkout.lines),
        expirationTime: PREORDER_CHECKOUT_EXPIRATION,
        successUrl: backUrl,
        failureUrl: backUrl,
        pendingUrl: backUrl,
        idempotencyKey: stableIdempotencyKey(`online-checkout:${checkout.id}`),
      });
    } catch {
      await this.checkouts.update({ ...checkout, status: 'cancelled' }).catch(() => undefined);
      return fail(PAYMENT_NOT_STARTED);
    }
    await this.checkouts.attachMercadoPagoOrder(checkout.id, order.id, order.checkoutUrl);
    return { ok: true, value: { trackingToken, checkoutUrl: order.checkoutUrl, total: checkout.total } };
  }
}

/**
 * One item per line with its IVA included, so the items add up to the total as Mercado Pago
 * requires. A line whose amount does not split evenly per unit goes as a single item "N × name".
 */
function mercadoPagoItems(lines: OnlineCheckoutLine[]): MercadoPagoOrderItem[] {
  return lines.map((line) => {
    const amount = line.totalPrice + line.taxAmount;
    return amount % line.quantity === 0
      ? { title: line.productName, quantity: line.quantity, unitPrice: amount / line.quantity }
      : { title: `${line.quantity} × ${line.productName}`, quantity: 1, unitPrice: amount };
  });
}
