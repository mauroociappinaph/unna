import { Prisma } from '@prisma/client';
import { Page, PageRequest, toPage } from '@unna/domain';

// Keyset pagination of the business lists (S17), newest first by (createdAt, id).
//
// The cursor row is looked up inside the business first: a cursor of another business, or an
// unknown one, gives null (the caller answers 400) and never shapes the query. Then the page is
// "rows strictly before the cursor" in that order, instead of Prisma's `cursor` + `skip: 1`: that
// skip drops a valid row whenever the cursor row no longer matches the filters (e.g. an order that
// was closed between two pages of `open=true`).

export const NEWEST_FIRST: Array<{ createdAt?: Prisma.SortOrder; id?: Prisma.SortOrder }> = [{ createdAt: 'desc' }, { id: 'desc' }];

interface KeysetCursor {
  id: string;
  createdAt: Date;
}

/** The rows after the cursor in NEWEST_FIRST order. */
export const afterCursor = (cursor: KeysetCursor) => ({
  OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }],
});

export const cursorFields = { id: true, createdAt: true } as const;

/**
 * Runs one page: `findCursor` reads the cursor row scoped by business, `findRows` reads up to
 * `take` rows (limit + 1) after it, already in NEWEST_FIRST order.
 */
export async function keysetPage<Row extends { id: string }>(
  page: PageRequest,
  findCursor: (id: string) => Promise<KeysetCursor | null>,
  findRows: (after: ReturnType<typeof afterCursor> | undefined, take: number) => Promise<Row[]>,
): Promise<Page<Row> | null> {
  let after: ReturnType<typeof afterCursor> | undefined;
  if (page.cursor !== undefined) {
    const cursor = await findCursor(page.cursor);
    if (!cursor) return null;
    after = afterCursor(cursor);
  }
  return toPage(await findRows(after, page.limit + 1), page.limit);
}

/** Maps the items of a page and keeps its cursor. */
export const mapPage = <A, B>(page: Page<A> | null, map: (item: A) => B): Page<B> | null =>
  page && { ...page, items: page.items.map(map) };

/** A `{ gte, lte }` filter with only the bounds that were given; undefined without bounds. */
export const withinDates = (from?: Date, to?: Date): { gte?: Date; lte?: Date } | undefined =>
  from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
