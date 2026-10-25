import type {
  IvaCondition, OrderAction, OrderItem, OrderLineInput, OrderStatus, OrderType, PaymentMethod, Receipt, ReceiptType,
} from '@/lib/api-types';

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

export const RECEIPT_TYPE_LABELS: Record<ReceiptType, string> = {
  ticket: 'Ticket',
  A: 'Factura A',
  B: 'Factura B',
  C: 'Factura C',
};

/** Receipts each issuer IVA condition may emit, the default first (S12). */
export const RECEIPT_CHOICES: Record<IvaCondition, ReceiptType[]> = {
  responsable_inscripto: ['B', 'A', 'ticket'],
  monotributo: ['C', 'ticket'],
  exento: ['C', 'ticket'],
  consumidor_final: ['ticket'],
};

export const IVA_CONDITION_LABELS: Record<IvaCondition, string> = {
  responsable_inscripto: 'Responsable inscripto',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'Consumidor final',
};

/** Catalog order of products and categories: display order, then name. */
export function compareByDisplayOrder(a: { displayOrder: number; name: string }, b: { displayOrder: number; name: string }): number {
  return a.displayOrder - b.displayOrder || a.name.localeCompare(b.name);
}

/** The line to send again when repeating an order: same product, quantity, modifiers and notes. */
export function toOrderLine(item: OrderItem): OrderLineInput {
  const modifiers = item.modifiers.map(({ modifierGroupId, optionId }) => ({ modifierGroupId, optionId }));
  return {
    productId: item.productId,
    quantity: item.quantity,
    ...(item.notes ? { notes: item.notes } : {}),
    ...(modifiers.length > 0 ? { modifiers } : {}),
  };
}

/** "0003-00000001" once numbered; the stored receipt number otherwise. */
export function receiptNumberLabel(receipt: Receipt): string {
  return receipt.invoiceNumber ? `${receipt.pointOfSale}-${String(receipt.invoiceNumber).padStart(8, '0')}` : receipt.receiptNumber;
}

/** e.g. "04/11/2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** e.g. "25/10/2026, 18:47". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
