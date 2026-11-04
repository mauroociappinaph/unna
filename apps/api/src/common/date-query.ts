import { BadRequestException } from '@nestjs/common';

export const INVALID_DATE = 'Fecha inválida';

/**
 * A `from`/`to` query filter as a Date. Some ISO 8601 forms pass @IsDateString but Date cannot
 * parse them (week "2026-W43", ordinal "2026-300", basic "20261026"): 400 instead of an Invalid
 * Date reaching the database.
 */
export function dateQuery(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new BadRequestException(INVALID_DATE);
  return date;
}
