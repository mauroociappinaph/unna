import type { OrderAction, OrderStatus, OrderType, PaymentMethod } from '@/lib/api-types';

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  dine_in: 'Salón',
  takeaway: 'Para llevar',
  delivery: 'Delivery',
  pickup: 'Retiro',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  mercado_pago: 'Mercado Pago',
  transfer: 'Transferencia',
  qr: 'QR',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

export const ACTION_LABELS: Record<Exclude<OrderAction, 'cancel'>, string> = {
  confirm: 'Confirmar',
  prepare: 'Preparar',
  ready: 'Marcar listo',
  deliver: 'Entregar',
};

/** Next forward action for each status; statuses without one are final. */
export const NEXT_ACTION: Partial<Record<OrderStatus, Exclude<OrderAction, 'cancel'>>> = {
  pending: 'confirm',
  confirmed: 'prepare',
  preparing: 'ready',
  ready: 'deliver',
};

export const CLOSED_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'refunded'];
