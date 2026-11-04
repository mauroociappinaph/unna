import type { CashSessionProps } from './cash-session';

/** A session as the list shows it (S17): every field but the movements, with how many there are. */
export type CashSessionSummary = Omit<CashSessionProps, 'movements'> & { movementCount: number };
