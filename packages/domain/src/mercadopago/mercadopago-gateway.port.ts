// Contract with Mercado Pago (OAuth, stores and POS, Orders API with type "qr" and "online"). The seller's access
// token is passed per call; adapters never log it nor put it in error messages. Amounts are integer
// cents; adapters convert to Mercado Pago's decimal strings.

export interface MercadoPagoTokens {
  accessToken: string;
  /** Single use: every refresh returns a new one that must replace the stored one. */
  refreshToken: string;
  expiresInSeconds: number;
  scope: string;
  /** Mercado Pago user id of the seller (the café). */
  mpUserId: string;
  liveMode: boolean;
}

export interface MercadoPagoStoreLocation {
  streetName: string;
  streetNumber: string;
  cityName: string;
  stateName: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateMercadoPagoStoreRequest {
  mpUserId: string;
  name: string;
  externalId: string;
  location: MercadoPagoStoreLocation;
}

export interface CreateMercadoPagoPosRequest {
  name: string;
  storeId: string;
  externalId: string;
  idempotencyKey: string;
}

/** The POS's static QR (printed at the counter). */
export interface MercadoPagoPos {
  id: string;
  externalId: string;
  qrImageUrl: string;
  qrTemplateUrl: string;
}

export interface CreateMercadoPagoQrOrderRequest {
  /** UNNA reference, ≤64 chars of [A-Za-z0-9_-], no personal data. */
  externalReference: string;
  /** External id of the POS whose printed QR can also pay this order (hybrid mode). */
  externalPosId: string;
  /** Integer cents. */
  amount: number;
  description: string;
  /** ISO 8601 duration, e.g. "PT15M". */
  expirationTime: string;
  idempotencyKey: string;
}

/** One line of an online order; Mercado Pago requires the lines to add up to the total. */
export interface MercadoPagoOrderItem {
  title: string;
  quantity: number;
  /** Integer cents. */
  unitPrice: number;
}

/** Checkout Pro through the Orders API (`type: "online"`, S20). */
export interface CreateMercadoPagoOnlineOrderRequest {
  /** UNNA reference, ≤64 chars of [A-Za-z0-9_-], no personal data. */
  externalReference: string;
  /** Integer cents; equals the sum of the items. */
  amount: number;
  items: MercadoPagoOrderItem[];
  /** ISO 8601 duration, e.g. "PT15M". */
  expirationTime: string;
  /** Where Mercado Pago sends the buyer back; its `status` is only a hint, never a payment proof. */
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  idempotencyKey: string;
}

export interface MercadoPagoOnlineOrder {
  id: string;
  status: MercadoPagoOrderStatus;
  /** Where the buyer pays. */
  checkoutUrl: string;
}

/**
 * created = unpaid; processing/action_required = payment in progress; processed = paid; failed =
 * payment rejected; the rest are terminal without a (current) payment.
 */
export type MercadoPagoOrderStatus =
  | 'created'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'refunded'
  | 'expired'
  | 'canceled'
  | 'action_required'
  | 'unknown';

export interface MercadoPagoOrder {
  id: string;
  status: MercadoPagoOrderStatus;
  statusDetail: string | null;
  externalReference: string | null;
  /** Integer cents. */
  totalAmount: number;
  paymentId: string | null;
  /** EMVCo string for the on-screen QR; only on creation. */
  qrData: string | null;
}

export interface MercadoPagoGatewayPort {
  /** Where the owner authorizes UNNA; `codeChallenge` is the PKCE S256 challenge. */
  buildAuthorizationUrl(params: { state: string; codeChallenge: string }): string;
  exchangeCode(params: { code: string; codeVerifier: string }): Promise<MercadoPagoTokens>;
  refreshToken(refreshToken: string): Promise<MercadoPagoTokens>;
  createStore(accessToken: string, request: CreateMercadoPagoStoreRequest): Promise<{ id: string }>;
  createPos(accessToken: string, request: CreateMercadoPagoPosRequest): Promise<MercadoPagoPos>;
  createQrOrder(accessToken: string, request: CreateMercadoPagoQrOrderRequest): Promise<MercadoPagoOrder>;
  createOnlineOrder(accessToken: string, request: CreateMercadoPagoOnlineOrderRequest): Promise<MercadoPagoOnlineOrder>;
  getOrder(accessToken: string, orderId: string): Promise<MercadoPagoOrder>;
  /** Only orders still `created` can be cancelled. */
  cancelOrder(accessToken: string, orderId: string, idempotencyKey: string): Promise<MercadoPagoOrder>;
}
