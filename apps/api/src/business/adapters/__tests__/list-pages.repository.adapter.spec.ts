import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaOrderRepositoryAdapter } from '../sales.repository.adapter';
import { PrismaFiscalReceiptRepositoryAdapter } from '../receipt.repository.adapter';
import { PrismaCashSessionRepositoryAdapter } from '../cash.repository.adapter';
import { PrismaStockMovementRepositoryAdapter } from '../stock-movement.repository.adapter';
import { fake } from '../../use-cases/__tests__/test-doubles';
import { inMemoryTable, Row } from './in-memory-table';

// S17: the four business lists page newest first by (createdAt, id), scoped by business, and the
// order, receipt and cash lists carry a count instead of their child rows.

const at = (minute: number) => new Date(Date.UTC(2026, 9, 25, 12, minute));
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

const orderRow = (id: string, minute: number, extra: Partial<Row> = {}): Row => ({
  id, businessId: 'biz-A', sucursalId: 'suc-1', orderNumber: `N-${id}`, type: 'takeaway', status: 'pending',
  tableNumber: null, customerName: null, customerPhone: null, customerEmail: null, deliveryAddress: null,
  subtotal: 1000, taxAmount: 210, discountAmount: 0, totalAmount: 1210, paymentStatus: 'pending',
  paymentMethod: null, paymentReference: null, notes: null, sucursalName: 'Centro',
  createdAt: at(minute), updatedAt: at(minute), completedAt: null, cancelledAt: null, cancelledReason: null, ...extra,
});

const orderItem = (orderId: string, n: number) => ({
  id: `${orderId}-i${n}`, orderId, productId: 'p1', productName: 'Café', productSku: null, quantity: 1,
  unitPrice: 1000, totalPrice: 1000, taxRate: 21, taxAmount: 210, notes: null, modifiers: [], createdAt: at(0), updatedAt: at(0),
});

// o5 and o4 share createdAt: the id breaks the tie. x1 belongs to another business.
const ordersFixture = () => {
  const rows = [
    orderRow('o1', 1, { status: 'delivered' }),
    orderRow('o2', 2),
    orderRow('o3', 3, { status: 'cancelled', sucursalId: 'suc-2' }),
    orderRow('o4', 4),
    orderRow('o5', 4, { status: 'refunded' }),
    orderRow('o6', 6, { status: 'ready' }),
    orderRow('x1', 5, { businessId: 'biz-B' }),
  ];
  const items = (id: string) => (id === 'o6' ? [orderItem(id, 1), orderItem(id, 2), orderItem(id, 3)] : [orderItem(id, 1)]);
  const table = inMemoryTable(rows, (row) => ({ ...row, items: items(row.id), _count: { items: items(row.id).length } }));
  const repository = new PrismaOrderRepositoryAdapter(fake<PrismaService>({ order: table }));
  return { repository, table };
};

const ids = (page: { items: Array<{ id: string }> } | null) => page?.items.map((i) => i.id);

describe('PrismaOrderRepositoryAdapter.findPageByBusinessId (S17)', () => {
  it('pages newest first without repeating or skipping orders, and says when more follow', async () => {
    const { repository } = ordersFixture();

    const first = await repository.findPageByBusinessId('biz-A', {}, { limit: 2 });
    const second = await repository.findPageByBusinessId('biz-A', {}, { limit: 2, cursor: first!.nextCursor });
    const third = await repository.findPageByBusinessId('biz-A', {}, { limit: 2, cursor: second!.nextCursor });

    expect([ids(first), first!.nextCursor]).toEqual([['o6', 'o5'], 'o5']);
    expect([ids(second), second!.nextCursor]).toEqual([['o4', 'o3'], 'o3']);
    expect([ids(third), third!.nextCursor]).toEqual([['o2', 'o1'], undefined]);
  });

  it('has no next cursor when the last page is exactly full', async () => {
    const { repository } = ordersFixture();

    const page = await repository.findPageByBusinessId('biz-A', {}, { limit: 6 });

    expect(ids(page)).toEqual(['o6', 'o5', 'o4', 'o3', 'o2', 'o1']);
    expect(page!.nextCursor).toBeUndefined();
  });

  it('asks for one row more than the limit, newest first by createdAt then id, without loading the items', async () => {
    const { repository, table } = ordersFixture();

    await repository.findPageByBusinessId('biz-A', {}, { limit: 2 });

    const query = table.calls.findMany[0];
    expect(query.take).toBe(3);
    expect(query.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(query.include).toEqual({ _count: { select: { items: true } } });
  });

  it('returns the order fields without the items, with the item count', async () => {
    const { repository } = ordersFixture();

    const page = await repository.findPageByBusinessId('biz-A', {}, { limit: 1 });
    const detail = await repository.findByIdAndBusinessId('o6', 'biz-A');
    const { items, ...fields } = json(detail);

    expect(items).toHaveLength(3);
    expect(json(page!.items[0])).toEqual({ ...fields, itemCount: 3 });
  });

  it('keeps the detail with its items (GET orders/:id unchanged)', async () => {
    const { repository, table } = ordersFixture();

    const detail = await repository.findByIdAndBusinessId('o6', 'biz-A');

    expect(table.calls.findFirst[0]).toEqual({ where: { id: 'o6', businessId: 'biz-A' }, include: { items: true } });
    expect(json(detail)).toMatchObject({ id: 'o6', status: 'ready', totalAmount: { amount: 1210, currency: 'ARS' }, sucursalName: 'Centro' });
    expect(json(detail!.items[0])).toMatchObject({ id: 'o6-i1', orderId: 'o6', productName: 'Café', unitPrice: { amount: 1000, currency: 'ARS' } });
    expect(detail!.items).toHaveLength(3);
  });

  it('rejects a cursor of another business or an unknown one (null) and never lists other businesses', async () => {
    const { repository } = ordersFixture();

    await expect(repository.findPageByBusinessId('biz-A', {}, { limit: 2, cursor: 'x1' })).resolves.toBeNull();
    await expect(repository.findPageByBusinessId('biz-A', {}, { limit: 2, cursor: 'nope' })).resolves.toBeNull();
    expect(ids(await repository.findPageByBusinessId('biz-B', {}, { limit: 50 }))).toEqual(['x1']);
  });

  it('with open lists only the orders that are not delivered, cancelled or refunded', async () => {
    const { repository } = ordersFixture();

    expect(ids(await repository.findPageByBusinessId('biz-A', { open: true }, { limit: 50 }))).toEqual(['o6', 'o4', 'o2']);
    expect(ids(await repository.findPageByBusinessId('biz-A', { open: false }, { limit: 50 }))).toHaveLength(6);
  });

  it('keeps the status, sucursal and date filters, also together with open and the cursor', async () => {
    const { repository } = ordersFixture();

    expect(ids(await repository.findPageByBusinessId('biz-A', { status: 'pending' }, { limit: 50 }))).toEqual(['o4', 'o2']);
    expect(ids(await repository.findPageByBusinessId('biz-A', { sucursalId: 'suc-2' }, { limit: 50 }))).toEqual(['o3']);
    expect(ids(await repository.findPageByBusinessId('biz-A', { from: at(2), to: at(4) }, { limit: 50 }))).toEqual(['o5', 'o4', 'o3', 'o2']);
    expect(ids(await repository.findPageByBusinessId('biz-A', { status: 'delivered', open: true }, { limit: 50 }))).toEqual([]);
    expect(ids(await repository.findPageByBusinessId('biz-A', { open: true }, { limit: 50, cursor: 'o5' }))).toEqual(['o4', 'o2']);
  });
});

const receiptRow = (id: string, minute: number, businessId = 'biz-A'): Row => ({
  id, businessId, sucursalId: 'suc-1', receiptNumber: `T-${id}`, invoiceNumber: null, type: 'B', status: 'issued',
  orderId: 'o1', orderNumber: 'N-o1', cae: null, caeExpiration: null, pointOfSale: '0001', receiptType: 'B',
  subtotal: 1000, taxAmount: 210, discountAmount: 0, totalAmount: 1210, paymentMethod: 'cash', paymentReference: null,
  customerName: null, customerTaxId: null, customerAddress: null, customerCondition: null, docType: 99, docNumber: '0',
  ivaBreakdown: [{ rate: 21, base: 1000, amount: 210 }], authorizationError: null, caeRequest: null, caeResponse: null,
  pdfUrl: null, qrCode: null, notes: null, createdAt: at(minute), updatedAt: at(minute), issuedAt: at(minute),
  cancelledAt: null, cancelledReason: null,
});

describe('PrismaFiscalReceiptRepositoryAdapter.findPageByBusinessId (S17)', () => {
  const setup = () => {
    const rows = [receiptRow('r1', 1), receiptRow('r2', 2), receiptRow('r3', 3), receiptRow('x1', 4, 'biz-B')];
    const items = (id: string) =>
      [1, 2].map((n) => ({ ...orderItem(id, n), receiptId: id, orderId: undefined }));
    const table = inMemoryTable(rows, (row) => ({ ...row, items: items(row.id), _count: { items: 2 } }));
    return { repository: new PrismaFiscalReceiptRepositoryAdapter(fake<PrismaService>({ receipt: table })), table };
  };

  it('pages newest first and returns the receipt fields without items, with the item count', async () => {
    const { repository, table } = setup();

    const first = await repository.findPageByBusinessId('biz-A', { limit: 2 });
    const second = await repository.findPageByBusinessId('biz-A', { limit: 2, cursor: first!.nextCursor });
    const { items, ...fields } = json(await repository.findByIdAndBusinessId('r3', 'biz-A'));

    expect([ids(first), first!.nextCursor, ids(second), second!.nextCursor]).toEqual([['r3', 'r2'], 'r2', ['r1'], undefined]);
    expect(items).toHaveLength(2);
    expect(json(first!.items[0])).toEqual({ ...fields, itemCount: 2 });
    expect(table.calls.findMany[0].include).toEqual({ _count: { select: { items: true } } });
  });

  it('rejects a cursor of another business', async () => {
    const { repository } = setup();

    await expect(repository.findPageByBusinessId('biz-A', { limit: 2, cursor: 'x1' })).resolves.toBeNull();
  });
});

const sessionRow = (id: string, minute: number, extra: Partial<Row> = {}): Row => ({
  id, businessId: 'biz-A', sucursalId: 'suc-1', status: 'closed', openedBy: 'u1', openedAt: at(minute), openingAmount: 1000,
  closedBy: 'u1', closedAt: at(minute + 1), expected: null, declared: null, difference: null, notes: null,
  createdAt: at(minute), updatedAt: at(minute), ...extra,
});

describe('PrismaCashSessionRepositoryAdapter.findPageByBusiness (S17)', () => {
  const setup = () => {
    const rows = [sessionRow('s1', 1), sessionRow('s2', 2, { sucursalId: 'suc-2' }), sessionRow('s3', 3, { status: 'open' }), sessionRow('x1', 4, { businessId: 'biz-B' })];
    const movements = (id: string) => (id === 's3' ? [{ id: 'm1', sessionId: id, type: 'in', amount: 5, reason: 'x', createdBy: 'u1', createdAt: at(3) }] : []);
    const table = inMemoryTable(rows, (row) => ({ ...row, movements: movements(row.id), _count: { movements: movements(row.id).length } }));
    return { repository: new PrismaCashSessionRepositoryAdapter(fake<PrismaService>({ cashSession: table })), table };
  };

  it('pages newest first with the movement count instead of the movements', async () => {
    const { repository, table } = setup();

    const first = await repository.findPageByBusiness('biz-A', {}, { limit: 2 });
    const second = await repository.findPageByBusiness('biz-A', {}, { limit: 2, cursor: first!.nextCursor });
    const { movements, ...fields } = json(await repository.findByIdAndBusinessId('s3', 'biz-A'));

    expect([ids(first), first!.nextCursor, ids(second), second!.nextCursor]).toEqual([['s3', 's2'], 's2', ['s1'], undefined]);
    expect(movements).toHaveLength(1);
    expect(json(first!.items[0])).toEqual({ ...fields, movementCount: 1 });
    expect(table.calls.findMany[0].include).toEqual({ _count: { select: { movements: true } } });
    expect(table.calls.findMany[0].orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('keeps the detail with its movements (GET cash-sessions/:id unchanged)', async () => {
    const { repository } = setup();

    const detail = await repository.findByIdAndBusinessId('s3', 'biz-A');

    expect(detail!.isOpen).toBe(true);
    expect(detail!.movements).toEqual([{ id: 'm1', sessionId: 's3', type: 'in', amount: 5, reason: 'x', createdBy: 'u1', createdAt: at(3) }]);
  });

  it('keeps the sucursal, status and opening date filters and rejects a foreign cursor', async () => {
    const { repository } = setup();

    expect(ids(await repository.findPageByBusiness('biz-A', { sucursalId: 'suc-2' }, { limit: 50 }))).toEqual(['s2']);
    expect(ids(await repository.findPageByBusiness('biz-A', { status: 'open' }, { limit: 50 }))).toEqual(['s3']);
    expect(ids(await repository.findPageByBusiness('biz-A', { from: at(2), to: at(2) }, { limit: 50 }))).toEqual(['s2']);
    await expect(repository.findPageByBusiness('biz-A', {}, { limit: 2, cursor: 'x1' })).resolves.toBeNull();
  });
});

const movementRow = (id: string, minute: number, extra: Partial<Row> = {}): Row => ({
  id, productId: 'p1', businessId: 'biz-A', type: 'in', quantity: 1, reason: 'x', referenceId: null, referenceType: null,
  unitCost: null, totalCost: null, performedBy: 'u1', createdAt: at(minute), ...extra,
});

describe('PrismaStockMovementRepositoryAdapter.findPageByBusinessId (S17)', () => {
  const setup = () => {
    const rows = [movementRow('m1', 1), movementRow('m2', 2, { productId: 'p2' }), movementRow('m3', 3), movementRow('x1', 4, { businessId: 'biz-B' })];
    const table = inMemoryTable(rows);
    return { repository: new PrismaStockMovementRepositoryAdapter(fake<PrismaService>({ stockMovement: table })), table };
  };

  it('pages newest first and rejects a foreign cursor', async () => {
    const { repository, table } = setup();

    const first = await repository.findPageByBusinessId('biz-A', {}, { limit: 2 });
    const second = await repository.findPageByBusinessId('biz-A', {}, { limit: 2, cursor: first!.nextCursor });

    expect([ids(first), first!.nextCursor, ids(second), second!.nextCursor]).toEqual([['m3', 'm2'], 'm2', ['m1'], undefined]);
    expect(table.calls.findMany[0]).toMatchObject({ take: 3, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    await expect(repository.findPageByBusinessId('biz-A', {}, { limit: 2, cursor: 'x1' })).resolves.toBeNull();
  });

  it('filters by product and by each date bound, also together', async () => {
    const { repository } = setup();

    expect(ids(await repository.findPageByBusinessId('biz-A', { productId: 'p1' }, { limit: 50 }))).toEqual(['m3', 'm1']);
    expect(ids(await repository.findPageByBusinessId('biz-A', { from: at(2) }, { limit: 50 }))).toEqual(['m3', 'm2']);
    expect(ids(await repository.findPageByBusinessId('biz-A', { to: at(2) }, { limit: 50 }))).toEqual(['m2', 'm1']);
    expect(ids(await repository.findPageByBusinessId('biz-A', { productId: 'p1', from: at(1), to: at(2) }, { limit: 50 }))).toEqual(['m1']);
    expect(ids(await repository.findPageByBusinessId('biz-B', { productId: 'p1' }, { limit: 50 }))).toEqual(['x1']);
  });
});
