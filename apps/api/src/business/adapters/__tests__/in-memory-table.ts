// Just enough of a Prisma model delegate to run the list queries in memory: equality, the
// lt/lte/gt/gte/in/notIn operators, AND/OR, orderBy (array) and take.

export type Row = Record<string, unknown> & { id: string };
type Where = Record<string, unknown>;
type Operators = { lt?: unknown; lte?: unknown; gt?: unknown; gte?: unknown; in?: unknown[]; notIn?: unknown[] };

const comparable = (value: unknown) => (value instanceof Date ? value.getTime() : (value as number | string));

const isOperators = (value: unknown): value is Operators =>
  typeof value === 'object' && value !== null && !(value instanceof Date) && !Array.isArray(value);

function matchesField(actual: unknown, expected: unknown): boolean {
  if (!isOperators(expected)) return comparable(actual) === comparable(expected);
  const a = comparable(actual);
  const ops = expected;
  if (ops.lt !== undefined && !(a < comparable(ops.lt))) return false;
  if (ops.lte !== undefined && !(a <= comparable(ops.lte))) return false;
  if (ops.gt !== undefined && !(a > comparable(ops.gt))) return false;
  if (ops.gte !== undefined && !(a >= comparable(ops.gte))) return false;
  if (ops.in && !ops.in.includes(actual)) return false;
  if (ops.notIn && ops.notIn.includes(actual)) return false;
  return true;
}

export function matches(row: Row, where: Where = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    if (key === 'AND') return (expected as Where[]).every((w) => matches(row, w));
    if (key === 'OR') return (expected as Where[]).some((w) => matches(row, w));
    return matchesField(row[key], expected);
  });
}

type OrderBy = Array<Record<string, 'asc' | 'desc'>> | Record<string, 'asc' | 'desc'>;

function sortRows(rows: Row[], orderBy: OrderBy = []): Row[] {
  const keys = (Array.isArray(orderBy) ? orderBy : [orderBy]).flatMap((o) => Object.entries(o));
  return [...rows].sort((x, y) => {
    for (const [key, direction] of keys) {
      const a = comparable(x[key]);
      const b = comparable(y[key]);
      if (a !== b) return (a < b ? -1 : 1) * (direction === 'desc' ? -1 : 1);
    }
    return 0;
  });
}

/**
 * A model delegate over `rows`. `decorate` adds what an `include` would bring (e.g. `_count`).
 * Every call is recorded in `calls` so a test can check what the adapter asked for.
 */
export function inMemoryTable(rows: Row[], decorate: (row: Row) => Row = (row) => row) {
  const calls: { findFirst: Array<Record<string, unknown>>; findMany: Array<Record<string, unknown>> } = { findFirst: [], findMany: [] };
  return {
    calls,
    findFirst: async (args: { where?: Where }) => {
      calls.findFirst.push(args);
      const found = rows.find((r) => matches(r, args.where));
      return found ? decorate(found) : null;
    },
    findMany: async (args: { where?: Where; orderBy?: OrderBy; take?: number }) => {
      calls.findMany.push(args);
      const sorted = sortRows(rows.filter((r) => matches(r, args.where)), args.orderBy);
      return (args.take === undefined ? sorted : sorted.slice(0, args.take)).map(decorate);
    },
  };
}
