import { api, refreshAccessToken } from './api';
import type { OrderAction, OrderStatus, OrderType } from './api-types';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1`;

export interface BarTicketItem {
  productName: string;
  quantity: number;
  modifiers: string[];
  notes?: string;
}

export interface BarTicket {
  id: string;
  orderNumber: string;
  shortNumber: string;
  status: OrderStatus;
  customerName: string | null;
  type: OrderType;
  tableNumber: string | null;
  items: BarTicketItem[];
  createdAt: string;
  updatedAt: string;
}

export interface BarQueue {
  new: BarTicket[];
  preparing: BarTicket[];
  ready: BarTicket[];
}

export interface DisplayToken {
  token: string;
  /** e.g. "/pantalla/<token>"; the caller prepends the web origin. */
  path: string;
}

/** Mirrors the axios error shape so apiErrorMessage reads the API message. */
export class ApiRequestError extends Error {
  constructor(public readonly response: { status: number; data: unknown }) {
    super(`HTTP ${response.status}`);
  }
}

// The bar screen stays open all day, so an expired session is renewed once (same refresh as the
// axios interceptor) and the request retried; these calls use fetch with the owner token.
async function ownerRequest<T>(method: 'GET' | 'POST' | 'DELETE', path: string, renewedToken?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = renewedToken ?? localStorage.getItem('auth_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { method, headers, cache: 'no-store' });
  if (response.status === 401 && renewedToken === undefined) {
    const fresh = await refreshAccessToken();
    if (fresh) return ownerRequest<T>(method, path, fresh);
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiRequestError({ status: response.status, data });
  return data as T;
}

export function getBarQueue(businessId: string, sucursalId: string): Promise<BarQueue> {
  return ownerRequest('GET', `/businesses/${businessId}/bar-queue?sucursalId=${encodeURIComponent(sucursalId)}`);
}

export function createDisplayToken(businessId: string, sucursalId: string): Promise<DisplayToken> {
  return ownerRequest('POST', `/businesses/${businessId}/sucursales/${sucursalId}/display-token`);
}

export async function revokeDisplayToken(businessId: string, sucursalId: string): Promise<void> {
  await ownerRequest('DELETE', `/businesses/${businessId}/sucursales/${sucursalId}/display-token`);
}

export async function changeOrderStatus(businessId: string, orderId: string, action: OrderAction): Promise<void> {
  await api.changeOrderStatus(businessId, orderId, action);
}
