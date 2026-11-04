import type { AxiosInstance } from 'axios';
import { createCashApi } from '@/lib/api-client/cash';
import { createSalesApi } from '@/lib/api-client/sales';
import { createStockApi } from '@/lib/api-client/stock';

// axios exposes response headers lowercased.
const fakeClient = (data: unknown[], headers: Record<string, string> = {}) => {
  const get = jest.fn().mockResolvedValue({ data, headers });
  return { client: { get } as unknown as AxiosInstance, get };
};

describe('paginated lists (S17)', () => {
  it('listOrders sends the filters and the page, and reads the next cursor from X-Next-Cursor', async () => {
    const { client, get } = fakeClient([{ id: 'o-2' }, { id: 'o-1' }], { 'x-next-cursor': 'o-1' });

    const page = await createSalesApi(client).listOrders('biz-1', { sucursalId: 'suc-1', open: true, limit: 200, cursor: 'o-3' });

    expect(get).toHaveBeenCalledWith('/businesses/biz-1/orders', {
      params: { sucursalId: 'suc-1', open: true, limit: 200, cursor: 'o-3' },
    });
    expect(page).toEqual({ items: [{ id: 'o-2' }, { id: 'o-1' }], nextCursor: 'o-1' });
  });

  it('listCashSessions returns a null next cursor without X-Next-Cursor', async () => {
    const { client, get } = fakeClient([{ id: 's-1' }]);

    const page = await createCashApi(client).listCashSessions('biz-1', { sucursalId: 'suc-1', cursor: 's-9' });

    expect(get).toHaveBeenCalledWith('/businesses/biz-1/cash-sessions', { params: { sucursalId: 'suc-1', cursor: 's-9' } });
    expect(page).toEqual({ items: [{ id: 's-1' }], nextCursor: null });
  });

  it('listStockMovements sends the product and the page and reads X-Next-Cursor', async () => {
    const { client, get } = fakeClient([{ id: 'm-1' }], { 'x-next-cursor': 'm-1' });

    const page = await createStockApi(client).listStockMovements('biz-1', { productId: 'p-1', limit: 10 });

    expect(get).toHaveBeenCalledWith('/businesses/biz-1/stock/movements', { params: { productId: 'p-1', limit: 10 } });
    expect(page).toEqual({ items: [{ id: 'm-1' }], nextCursor: 'm-1' });
  });
});
