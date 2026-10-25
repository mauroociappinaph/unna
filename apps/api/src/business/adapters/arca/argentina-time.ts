// Argentina has used a fixed UTC-03:00 offset without daylight saving since 2009; ARCA dates and
// times are expressed in that offset.
const OFFSET_MS = -3 * 60 * 60 * 1000;

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

const shifted = (date: Date): Date => new Date(date.getTime() + OFFSET_MS);

/** e.g. 2026-10-25T12:00:00-03:00 */
export function argentineIsoDateTime(date: Date): string {
  const d = shifted(date);
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}-03:00`
  );
}

/** yyyymmdd of the Argentine calendar day. */
export function argentineDate(date: Date): string {
  const d = shifted(date);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** yyyymmdd → start of that Argentine day. */
export function parseArgentineDate(yyyymmdd: string): Date {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(yyyymmdd);
  if (!match) throw new Error(`Fecha de ARCA inválida: ${yyyymmdd}`);
  return new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00-03:00`);
}
