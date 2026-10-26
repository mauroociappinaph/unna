// Public pedido anticipado endpoints (S20): the customer's phone has no session, so these
// calls use plain fetch with no Authorization header and no credentials, like the TV screen.
// Amounts are integer cents. Contract: docs/integraciones/pedido-anticipado.md.

import type { SelectedModifier } from './api-types-sales';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1`;

export interface PublicModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface PublicModifierGroup {
  id: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  options: PublicModifierOption[];
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string | null;
  imageUrl: string | null;
  modifierGroups: PublicModifierGroup[];
}

export interface PublicMenu {
  businessName: string;
  sucursalName: string;
  /** False when the local is closed, has no open caja or no Mercado Pago; reason says why. */
  accepting: boolean;
  reason: string | null;
  estimatedMinutes: number;
  categories: { id: string; name: string }[];
  products: PublicProduct[];
}

export interface CheckoutLineInput {
  productId: string;
  quantity: number;
  modifiers?: SelectedModifier[];
  notes?: string;
}

export interface CheckoutInput {
  customerName: string;
  items: CheckoutLineInput[];
}

export interface CheckoutResult {
  trackingToken: string;
  checkoutUrl: string;
  total: number;
}

export type TrackingStatus =
  | 'awaiting_payment'
  | 'payment_failed'
  | 'expired'
  | 'received'
  | 'preparing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export interface OrderTracking {
  status: TrackingStatus;
  orderNumber: string | null;
  customerFirstName: string;
  businessName: string;
  sucursalName: string;
  total: number;
  items: { name: string; quantity: number }[];
  estimatedMinutes: number | null;
  updatedAt: string;
}

const NETWORK_ERROR = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.';
const RATE_LIMITED = 'Hay muchos pedidos en este momento. Esperá un minuto y probá de nuevo.';
const GENERIC_ERROR = 'Algo salió mal. Probá de nuevo en un momento.';

/** A failed public call; message is the Spanish text to show, status is 0 when the network failed. */
export class PublicOrderError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function messageOf(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  const message = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join('. ');
  if (typeof message === 'string' && message) return message;
  return response.status === 429 ? RATE_LIMITED : GENERIC_ERROR;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, cache: 'no-store', credentials: 'omit' });
  } catch {
    throw new PublicOrderError(NETWORK_ERROR, 0);
  }
  if (!response.ok) throw new PublicOrderError(await messageOf(response), response.status);
  return response.json();
}

export function getPublicMenu(slug: string): Promise<PublicMenu> {
  return request(`/public/pedido/${encodeURIComponent(slug)}`);
}

export function createCheckout(slug: string, input: CheckoutInput): Promise<CheckoutResult> {
  return request(`/public/pedido/${encodeURIComponent(slug)}/checkouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function getOrderTracking(token: string): Promise<OrderTracking> {
  return request(`/public/pedido/seguimiento/${encodeURIComponent(token)}`);
}
