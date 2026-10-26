import { NotFoundError } from '@unna/domain';
import { SalesUseCase } from '../sales.use-case';
import { InvoicingUseCase } from '../invoicing.use-case';
import { CashUseCase } from '../cash.use-case';
import { StockUseCase } from '../stock.use-case';
import { fake } from './test-doubles';

// S17: the list use cases hand the filters and the page to the repository and turn a cursor the
// repository does not know for the business into a client error, never into other data.

const PAGE = { items: [{ id: 'a' }], nextCursor: 'a' };
const REQUEST = { limit: 2, cursor: 'z' };

const sales = (findPageByBusinessId: jest.Mock) =>
  new SalesUseCase(fake({ findPageByBusinessId }), fake({}), fake({}), fake({}), fake({}), fake({}), fake({}));
const invoicing = (findPageByBusinessId: jest.Mock) =>
  new InvoicingUseCase(fake({}), fake({ findPageByBusinessId }), fake({}), fake({}), fake({}));
const cash = (findPageByBusiness: jest.Mock) => new CashUseCase(fake({ findPageByBusiness }), fake({}), fake({}));
const stock = (findPageByBusinessId: jest.Mock, product: unknown = { id: 'p1' }) =>
  new StockUseCase(fake({}), fake({ findPageByBusinessId }), fake({ findByIdAndBusinessId: async () => product }));

describe('list use cases (S17)', () => {
  it('listOrders passes the filters and the page and returns the page', async () => {
    const repository = jest.fn(async () => PAGE);

    const result = await sales(repository).listOrders('biz-A', { open: true, sucursalId: 's1' }, REQUEST);

    expect(result).toEqual({ ok: true, value: PAGE });
    expect(repository).toHaveBeenCalledWith('biz-A', { open: true, sucursalId: 's1' }, REQUEST);
  });

  it('listReceipts passes the page and returns it', async () => {
    const repository = jest.fn(async () => PAGE);

    expect(await invoicing(repository).listReceipts('biz-A', REQUEST)).toEqual({ ok: true, value: PAGE });
    expect(repository).toHaveBeenCalledWith('biz-A', REQUEST);
  });

  it('list (cash sessions) passes the filters and the page and returns the page', async () => {
    const repository = jest.fn(async () => PAGE);

    expect(await cash(repository).list('biz-A', { status: 'closed' }, REQUEST)).toEqual({ ok: true, value: PAGE });
    expect(repository).toHaveBeenCalledWith('biz-A', { status: 'closed' }, REQUEST);
  });

  it('listMovements passes the product, the dates and the page and returns the page', async () => {
    const repository = jest.fn(async () => PAGE);
    const filters = { productId: 'p1', from: new Date('2026-10-01'), to: new Date('2026-10-02') };

    expect(await stock(repository).listMovements('biz-A', filters, REQUEST)).toEqual({ ok: true, value: PAGE });
    expect(repository).toHaveBeenCalledWith('biz-A', filters, REQUEST);
  });

  it('listMovements still reports a product of another business as not found, without listing', async () => {
    const repository = jest.fn(async () => PAGE);

    const result = await stock(repository, null).listMovements('biz-A', { productId: 'p-B' }, REQUEST);

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(NotFoundError);
    expect(result.error?.message).toBe('Producto no encontrado');
    expect(repository).not.toHaveBeenCalled();
  });

  it.each([
    ['listOrders', (repository: jest.Mock) => sales(repository).listOrders('biz-A', {}, REQUEST)],
    ['listReceipts', (repository: jest.Mock) => invoicing(repository).listReceipts('biz-A', REQUEST)],
    ['list (cash sessions)', (repository: jest.Mock) => cash(repository).list('biz-A', {}, REQUEST)],
    ['listMovements', (repository: jest.Mock) => stock(repository).listMovements('biz-A', {}, REQUEST)],
  ])('%s rejects a cursor that is not of the business as a client error', async (_name, run) => {
    const result = await run(jest.fn(async () => null));

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe('Cursor inválido');
    expect(result.error).not.toBeInstanceOf(NotFoundError);
  });
});
