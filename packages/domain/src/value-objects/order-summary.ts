import type { OrderProps } from './order';

/** An order as the list shows it (S17): every field but the items, with how many there are. */
export type OrderSummary = Omit<OrderProps, 'items'> & { itemCount: number };
