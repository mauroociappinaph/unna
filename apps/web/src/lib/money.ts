// Peso amounts typed by users, in Argentine notation: dot for thousands, comma for decimals.
// The API works in integer cents.

const THOUSANDS = /^\d{1,3}(\.\d{3})+$/;
const WITH_COMMA = /^(\d+|\d{1,3}(\.\d{3})+),\d{1,2}$/;
const DOT_DECIMAL = /^\d+\.\d{1,2}$/;
const DIGITS = /^\d+$/;

/**
 * Reads a pesos amount as integer cents, or null when it is not a valid amount.
 * "1.500" and "1.500,50" use the dot for thousands; "1500.5" (one or two digits after
 * the dot) is read as a decimal. A leading "-" is allowed for discounts.
 */
export function parsePesos(text: string): number | null {
  const trimmed = text.trim();
  const negative = trimmed.startsWith('-');
  const body = negative ? trimmed.slice(1) : trimmed;

  let normalized: string;
  if (WITH_COMMA.test(body)) normalized = body.replace(/\./g, '').replace(',', '.');
  else if (THOUSANDS.test(body)) normalized = body.replace(/\./g, '');
  else if (DOT_DECIMAL.test(body) || DIGITS.test(body)) normalized = body;
  else return null;

  const cents = Math.round(Number(normalized) * 100);
  return negative ? -cents : cents;
}

/** Formats cents as an editable pesos value, e.g. 150050 -> "1500,50" and 150000 -> "1500". */
export function centsToInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const pesos = Math.floor(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? `${sign}${pesos}` : `${sign}${pesos},${String(rest).padStart(2, '0')}`;
}
