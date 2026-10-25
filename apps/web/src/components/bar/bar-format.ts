import type { OrderAction, OrderStatus } from '@/lib/api-types';

export const BAR_POLL_MS = 5000;
export const DELAYED_AFTER_MINUTES = 10;

export const elapsedMinutes = (createdAt: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60_000));

/** e.g. "recién", "hace 4 min", "hace 1 h 5 min". */
export function elapsedLabel(minutes: number): string {
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const rest = minutes % 60;
  return `hace ${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`;
}

/** Actions that take a ticket out of Nuevos: a pending order is confirmed before it is prepared. */
export const startActions = (status: OrderStatus): OrderAction[] => (status === 'pending' ? ['confirm', 'prepare'] : ['prepare']);
