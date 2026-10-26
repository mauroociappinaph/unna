import { randomBytes, randomUUID } from 'crypto';
import {
  CreateMercadoPagoPosRequest,
  CreateMercadoPagoQrOrderRequest,
  CreateMercadoPagoStoreRequest,
  MercadoPagoGatewayPort,
  MercadoPagoOrder,
  MercadoPagoPos,
  MercadoPagoTokens,
} from '@unna/domain';

const TOKEN_LIFETIME_SECONDS = 180 * 24 * 60 * 60;
const SIMULATED_USER_ID = '100000001';
const PLACEHOLDER_QR = 'https://simulador-mercadopago.unna.invalid/qr';

interface SimulatedOrder extends MercadoPagoOrder {
  expiresAt: Date;
}

/**
 * Stand-in for Mercado Pago while UNNA has no application credentials (S15). Never wired in
 * production. Authorizes instantly (the authorization URL is the API callback with a fake code),
 * creates fake stores and POS with placeholder QR URLs and keeps QR orders in memory; `markPaid`
 * plays the buyer scanning the QR.
 */
export class MercadoPagoSimulatorAdapter implements MercadoPagoGatewayPort {
  private readonly orders = new Map<string, SimulatedOrder>();
  private readonly ordersByIdempotencyKey = new Map<string, string>();
  private readonly cancelKeys = new Map<string, string>();

  constructor(
    private readonly callbackUrl: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  buildAuthorizationUrl({ state }: { state: string; codeChallenge: string }): string {
    const url = new URL(this.callbackUrl);
    url.searchParams.set('code', `SIM-${randomBytes(12).toString('hex')}`);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async exchangeCode({ code }: { code: string; codeVerifier: string }): Promise<MercadoPagoTokens> {
    if (!code.startsWith('SIM-')) throw new Error('Mercado Pago respondió 400 (invalid_grant)');
    return simulatedTokens();
  }

  async refreshToken(refreshToken: string): Promise<MercadoPagoTokens> {
    if (!refreshToken.startsWith('TG-SIM-')) throw new Error('Mercado Pago respondió 400 (invalid_grant)');
    return simulatedTokens();
  }

  async createStore(_accessToken: string, request: CreateMercadoPagoStoreRequest): Promise<{ id: string }> {
    return { id: `SIM-STORE-${request.externalId}` };
  }

  async createPos(_accessToken: string, request: CreateMercadoPagoPosRequest): Promise<MercadoPagoPos> {
    return {
      id: `SIM-POS-${request.externalId}`,
      externalId: request.externalId,
      qrImageUrl: `${PLACEHOLDER_QR}/${request.externalId}.png`,
      qrTemplateUrl: `${PLACEHOLDER_QR}/${request.externalId}.pdf`,
    };
  }

  async createQrOrder(_accessToken: string, request: CreateMercadoPagoQrOrderRequest): Promise<MercadoPagoOrder> {
    const existing = this.ordersByIdempotencyKey.get(request.idempotencyKey);
    if (existing) return this.getOrder('', existing);

    const id = `ORDSIM${randomUUID().replace(/-/g, '').toUpperCase()}`;
    const order: SimulatedOrder = {
      id,
      status: 'created',
      statusDetail: 'created',
      externalReference: request.externalReference,
      totalAmount: request.amount,
      paymentId: null,
      qrData: `00020101021243650016COM.MERCADOLIBRE0201306364SIMULADO-${id}5204970053030325802AR5909UNNA SIM6304ABCD`,
      expiresAt: new Date(this.now().getTime() + durationMs(request.expirationTime)),
    };
    this.orders.set(id, order);
    this.ordersByIdempotencyKey.set(request.idempotencyKey, id);
    return withoutExpiry(order);
  }

  async getOrder(_accessToken: string, orderId: string): Promise<MercadoPagoOrder> {
    const order = this.current(orderId);
    if (!order) throw new Error('Mercado Pago respondió 404 (order_not_found)');
    return withoutExpiry(order);
  }

  async cancelOrder(_accessToken: string, orderId: string, idempotencyKey: string): Promise<MercadoPagoOrder> {
    const order = this.current(orderId);
    if (!order) throw new Error('Mercado Pago respondió 404 (order_not_found)');
    // A retried cancel (same key) answers like the first one.
    if (this.cancelKeys.get(idempotencyKey) === orderId) return withoutExpiry(order);
    if (order.status === 'canceled') throw new Error('Mercado Pago respondió 409 (order_already_canceled)');
    if (order.status !== 'created') throw new Error(`Mercado Pago respondió 409 (order_already_${order.status})`);
    order.status = 'canceled';
    order.statusDetail = 'canceled';
    this.cancelKeys.set(idempotencyKey, orderId);
    return withoutExpiry(order);
  }

  /** Development only: pays an unpaid, unexpired order. False when there is nothing to pay. */
  markPaid(orderId: string): boolean {
    const order = this.current(orderId);
    if (!order || order.status !== 'created') return false;
    order.status = 'processed';
    order.statusDetail = 'accredited';
    order.paymentId = `PAYSIM${randomUUID().replace(/-/g, '').toUpperCase()}`;
    return true;
  }

  private current(orderId: string): SimulatedOrder | undefined {
    const order = this.orders.get(orderId);
    if (order && order.status === 'created' && this.now() > order.expiresAt) {
      order.status = 'expired';
      order.statusDetail = 'expired';
    }
    return order;
  }
}

function simulatedTokens(): MercadoPagoTokens {
  return {
    accessToken: `APP_USR-SIM-${randomBytes(16).toString('hex')}`,
    refreshToken: `TG-SIM-${randomBytes(16).toString('hex')}`,
    expiresInSeconds: TOKEN_LIFETIME_SECONDS,
    scope: 'offline_access read write',
    mpUserId: SIMULATED_USER_ID,
    liveMode: false,
  };
}

function withoutExpiry(order: SimulatedOrder): MercadoPagoOrder {
  return {
    id: order.id,
    status: order.status,
    statusDetail: order.statusDetail,
    externalReference: order.externalReference,
    totalAmount: order.totalAmount,
    paymentId: order.paymentId,
    qrData: order.qrData,
  };
}

/** Minutes and seconds of an ISO 8601 duration such as "PT15M"; 15 minutes when unparseable. */
function durationMs(duration: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(duration);
  if (!match || (!match[1] && !match[2] && !match[3])) return 15 * 60 * 1000;
  return ((Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)) * 60 + Number(match[3] ?? 0)) * 1000;
}
