import type { OrderStatus } from '../value-objects/order';
import type { DayOfWeek } from '../value-objects/schedule';

// Bar queue and public order board (S13): which of today's paid orders show up and where.

/** Argentina has no daylight saving time: local time is always UTC-3. */
const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses of orders that are still at the bar (not delivered, cancelled or refunded). */
export const BAR_QUEUE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'] as const satisfies readonly OrderStatus[];

export type BarQueueColumn = 'new' | 'preparing' | 'ready';
export type PublicBoardColumn = 'preparing' | 'ready';

/** [from, to) of the Argentine calendar day that contains `now`. */
export function argentinaDayWindow(now: Date): { from: Date; to: Date } {
  const local = now.getTime() - ARGENTINA_OFFSET_MS;
  const from = local - (((local % DAY_MS) + DAY_MS) % DAY_MS) + ARGENTINA_OFFSET_MS;
  return { from: new Date(from), to: new Date(from + DAY_MS) };
}

const WEEKDAYS: readonly DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Argentine weekday and HH:mm of `now`, as Schedule.isOpenAt takes them. */
export function argentinaClock(now: Date): { day: DayOfWeek; time: string } {
  const local = new Date(now.getTime() - ARGENTINA_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, '0');
  return { day: WEEKDAYS[local.getUTCDay()], time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}` };
}

/** What the customer hears called: the last 3 characters of the order number. */
export function shortOrderNumber(orderNumber: string): string {
  return orderNumber.slice(-3);
}

/** First word of the customer's name, at most 12 characters, or null when there is none. */
export function publicCustomerName(customerName?: string | null): string | null {
  const first = customerName?.trim().split(/\s+/)[0];
  return first ? first.slice(0, 12) : null;
}

export function barQueueColumn(status: OrderStatus): BarQueueColumn | null {
  switch (status) {
    case 'pending':
    case 'confirmed':
      return 'new';
    case 'preparing':
      return 'preparing';
    case 'ready':
      return 'ready';
    default:
      return null;
  }
}

/** The public board only says "en preparación" or "listo": anything not ready yet is preparing. */
export function publicBoardColumn(status: OrderStatus): PublicBoardColumn | null {
  const column = barQueueColumn(status);
  return column === 'new' ? 'preparing' : column;
}

/** Splits orders into the bar columns, oldest first; closed orders are left out. */
export function bucketBarQueue<T extends { status: OrderStatus; createdAt: Date }>(orders: T[]): Record<BarQueueColumn, T[]> {
  const buckets: Record<BarQueueColumn, T[]> = { new: [], preparing: [], ready: [] };
  const oldestFirst = [...orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const order of oldestFirst) {
    const column = barQueueColumn(order.status);
    if (column) buckets[column].push(order);
  }
  return buckets;
}

/** Display tokens are 32 random bytes in base64url (no padding): exactly 43 characters. */
const DISPLAY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedDisplayToken(token: string): boolean {
  return DISPLAY_TOKEN_PATTERN.test(token);
}
