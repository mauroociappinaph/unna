// Keyset pagination of the business lists (S17): newest first, `cursor` is the id of the last
// item the client received.

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export interface PageRequest {
  limit: number;
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  /** Id of the last item, present only when more items follow it. */
  nextCursor?: string;
}

/** `rows` holds up to limit + 1 rows: the extra one only tells that another page follows. */
export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  if (rows.length <= limit) return { items: rows };
  const items = rows.slice(0, limit);
  return { items, nextCursor: items[items.length - 1].id };
}
