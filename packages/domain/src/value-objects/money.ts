export type Currency = 'ARS' | 'USD' | 'EUR' | 'BRL' | 'MXN' | 'CLP' | 'COP' | 'PEN' | 'UYU' | 'BOB' | 'PYG' | 'VES';

export interface MoneyProps {
  amount: number;  // stored in cents (integer) to avoid floating point issues
  currency: Currency;
}

export class Money {
  public readonly amount: number;  // in cents
  public readonly currency: Currency;

  private constructor(amount: number, currency: Currency) {
    this.amount = amount;
    this.currency = currency;
  }

  public static fromCents(amount: number, currency: Currency = 'ARS'): Money {
    if (!Number.isInteger(amount)) {
      throw new Error('Monto en centavos debe ser un entero');
    }
    if (amount < 0) {
      throw new Error('Monto no puede ser negativo');
    }
    return new Money(amount, currency);
  }

  public static fromDecimal(decimal: number, currency: Currency = 'ARS'): Money {
    if (decimal < 0) {
      throw new Error('Monto no puede ser negativo');
    }
    const cents = Math.round(decimal * 100);
    return new Money(cents, currency);
  }

  public static zero(currency: Currency = 'ARS'): Money {
    return new Money(0, currency);
  }

  public add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('No se pueden sumar montos de diferentes monedas');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  public subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('No se pueden restar montos de diferentes monedas');
    }
    if (this.amount < other.amount) {
      throw new Error('Resultado no puede ser negativo');
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  public multiply(factor: number): Money {
    if (factor < 0) {
      throw new Error('Factor no puede ser negativo');
    }
    return new Money(Math.round(this.amount * factor), this.currency);
  }

  public divide(divisor: number): Money {
    if (divisor === 0) {
      throw new Error('No se puede dividir por cero');
    }
    if (divisor < 0) {
      throw new Error('Divisor no puede ser negativo');
    }
    return new Money(Math.round(this.amount / divisor), this.currency);
  }

  public percentage(percent: number): Money {
    if (percent < 0) {
      throw new Error('Porcentaje no puede ser negativo');
    }
    return new Money(Math.round(this.amount * percent / 100), this.currency);
  }

  public toDecimal(): number {
    return this.amount / 100;
  }

  public toCents(): number {
    return this.amount;
  }

  public getCurrency(): Currency {
    return this.currency;
  }

  public format(locale: string = 'es-AR'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.toDecimal());
  }

  public formatCompact(locale: string = 'es-AR'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(this.toDecimal());
  }

  public equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  public isZero(): boolean {
    return this.amount === 0;
  }

  public isPositive(): boolean {
    return this.amount > 0;
  }

  public isNegative(): boolean {
    return this.amount < 0;
  }

  public compareTo(other: Money): number {
    if (this.currency !== other.currency) {
      throw new Error('No se pueden comparar montos de diferentes monedas');
    }
    if (this.amount < other.amount) return -1;
    if (this.amount > other.amount) return 1;
    return 0;
  }

  public toString(): string {
    return `${this.format()}`;
  }

  public toJSON(): { amount: number; currency: Currency } {
    return { amount: this.amount, currency: this.currency };
  }

  public static fromJSON(json: { amount: number; currency: Currency }): Money {
    return new Money(json.amount, json.currency);
  }
}

// Currency configuration
export const CURRENCY_CONFIG: Record<Currency, { symbol: string; decimals: number; name: string }> = {
  ARS: { symbol: '$', decimals: 2, name: 'Peso Argentino' },
  USD: { symbol: 'US$', decimals: 2, name: 'Dólar Estadounidense' },
  EUR: { symbol: '€', decimals: 2, name: 'Euro' },
  BRL: { symbol: 'R$', decimals: 2, name: 'Real Brasileño' },
  MXN: { symbol: '$', decimals: 2, name: 'Peso Mexicano' },
  CLP: { symbol: '$', decimals: 0, name: 'Peso Chileno' },
  COP: { symbol: '$', decimals: 0, name: 'Peso Colombiano' },
  PEN: { symbol: 'S/', decimals: 2, name: 'Sol Peruano' },
  UYU: { symbol: '$', decimals: 2, name: 'Peso Uruguayo' },
  BOB: { symbol: 'Bs', decimals: 2, name: 'Boliviano' },
  PYG: { symbol: '₲', decimals: 0, name: 'Guaraní Paraguayo' },
  VES: { symbol: 'Bs.', decimals: 2, name: 'Bolívar Venezolano' },
} as const;

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_CONFIG[currency]?.symbol || currency;
}

export function getCurrencyDecimals(currency: Currency): number {
  return CURRENCY_CONFIG[currency]?.decimals ?? 2;
}