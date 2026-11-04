import { Money } from '@unna/domain';

// Stored currency codes were written from Money, so they are always a supported currency.
export const money = (cents: number, currency = 'ARS') => Money.fromCents(cents, currency as Money['currency']);
