import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../../app-setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../../common/guards/business-owner.guard';
import { SalesController } from '../sales.controller';
import { CashController } from '../cash.controller';
import { StockController } from '../stock.controller';
import { SalesUseCase } from '../use-cases/sales.use-case';
import { InvoicingUseCase } from '../use-cases/invoicing.use-case';
import { CashUseCase } from '../use-cases/cash.use-case';
import { StockUseCase } from '../use-cases/stock.use-case';

// S17 HTTP contract of the four paginated lists: `limit` (1..200, default 50) and `cursor` in the
// query, the page items as the body and `X-Next-Cursor` only when another page follows.

const BASE = '/api/v1/businesses/biz-A';
const page = (nextCursor?: string) => ({ ok: true, value: { items: [{ id: 'b' }, { id: 'a' }], ...(nextCursor ? { nextCursor } : {}) } });

describe('paginated lists over HTTP (S17)', () => {
  let app: INestApplication;
  const listOrders = jest.fn();
  const listReceipts = jest.fn();
  const listCash = jest.fn();
  const listMovements = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SalesController, CashController, StockController],
      providers: [
        { provide: SalesUseCase, useValue: { listOrders } },
        { provide: InvoicingUseCase, useValue: { listReceipts } },
        { provide: CashUseCase, useValue: { list: listCash } },
        { provide: StockUseCase, useValue: { listMovements } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(BusinessOwnerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, { NODE_ENV: 'production', FRONTEND_URL: 'https://web.test' });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    for (const list of [listOrders, listReceipts, listCash, listMovements]) {
      list.mockReset();
      list.mockResolvedValue(page());
    }
  });

  const routes = [
    ['orders', listOrders],
    ['receipts', listReceipts],
    ['cash-sessions', listCash],
    ['stock/movements', listMovements],
  ] as const;
  const lastArg = (mock: jest.Mock) => mock.mock.calls[0][mock.mock.calls[0].length - 1];

  describe.each(routes)('GET %s', (path, list) => {
    it('asks for 50 items by default and sends no X-Next-Cursor when no page follows', async () => {
      const res = await request(app.getHttpServer()).get(`${BASE}/${path}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'b' }, { id: 'a' }]);
      expect(res.headers['x-next-cursor']).toBeUndefined();
      expect(lastArg(list)).toEqual({ limit: 50 });
    });

    it('passes limit and cursor and sends X-Next-Cursor with the next page cursor', async () => {
      list.mockResolvedValue(page('a'));

      const res = await request(app.getHttpServer()).get(`${BASE}/${path}`).query({ limit: '200', cursor: 'c-1' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 'b' }, { id: 'a' }]);
      expect(res.headers['x-next-cursor']).toBe('a');
      expect(lastArg(list)).toEqual({ limit: 200, cursor: 'c-1' });
    });

    it.each(['0', '201', '-1', '2.5', 'abc'])('answers 400 for limit=%p without listing', async (limit) => {
      const res = await request(app.getHttpServer()).get(`${BASE}/${path}`).query({ limit });

      expect(res.status).toBe(400);
      expect(list).not.toHaveBeenCalled();
    });

    it('answers 400 "Cursor inválido" when the cursor is not of the business', async () => {
      list.mockResolvedValue({ ok: false, error: new Error('Cursor inválido') });

      const res = await request(app.getHttpServer()).get(`${BASE}/${path}`).query({ cursor: 'foreign' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Cursor inválido');
      expect(res.headers['x-next-cursor']).toBeUndefined();
    });
  });

  it('lets the browser read X-Next-Cursor (CORS exposed header)', async () => {
    listOrders.mockResolvedValue(page('a'));

    const res = await request(app.getHttpServer()).get(`${BASE}/orders`).set('Origin', 'https://web.test');

    expect(res.headers['access-control-allow-origin']).toBe('https://web.test');
    expect(res.headers['access-control-expose-headers']).toContain('X-Next-Cursor');
  });

  describe('GET orders filters', () => {
    it('passes open=true as the open filter, together with the other filters', async () => {
      const from = '2026-10-25T03:00:00.000Z';
      await request(app.getHttpServer()).get(`${BASE}/orders`).query({ open: 'true', from, status: 'ready', sucursalId: '7b0c1f7e-4a8e-4c7e-9a52-0d2c8d7c1a11' });

      expect(listOrders).toHaveBeenCalledWith(
        'biz-A',
        { open: true, status: 'ready', sucursalId: '7b0c1f7e-4a8e-4c7e-9a52-0d2c8d7c1a11', from: new Date(from), to: undefined },
        { limit: 50 },
      );
    });

    it('treats open=false or no open as every order', async () => {
      await request(app.getHttpServer()).get(`${BASE}/orders`).query({ open: 'false' });
      await request(app.getHttpServer()).get(`${BASE}/orders`);

      expect(listOrders.mock.calls[0][1]).toMatchObject({ open: false });
      expect(listOrders.mock.calls[1][1]).toMatchObject({ open: false });
    });

    it('answers 400 for an open value other than true or false', async () => {
      const res = await request(app.getHttpServer()).get(`${BASE}/orders`).query({ open: 'yes' });

      expect(res.status).toBe(400);
      expect(listOrders).not.toHaveBeenCalled();
    });
  });

  it('GET cash-sessions keeps its filters', async () => {
    await request(app.getHttpServer()).get(`${BASE}/cash-sessions`).query({ status: 'closed', from: '2026-10-01T00:00:00.000Z' });

    expect(listCash).toHaveBeenCalledWith('biz-A', { sucursalId: undefined, status: 'closed', from: new Date('2026-10-01T00:00:00.000Z'), to: undefined }, { limit: 50 });
  });

  it('GET stock/movements keeps the product and date filters', async () => {
    await request(app.getHttpServer())
      .get(`${BASE}/stock/movements`)
      .query({ productId: 'p1', from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z', limit: '10' });

    expect(listMovements).toHaveBeenCalledWith(
      'biz-A',
      { productId: 'p1', from: new Date('2026-10-01T00:00:00.000Z'), to: new Date('2026-10-02T00:00:00.000Z') },
      { limit: 10 },
    );
  });

  describe.each([
    ['orders', listOrders],
    ['cash-sessions', listCash],
    ['stock/movements', listMovements],
  ] as const)('GET %s date filters', (path, list) => {
    // ISO 8601 forms the validator accepts but Date cannot parse (week, ordinal, basic, hour only).
    it.each(['from', 'to'])('answers 400 "Fecha inválida" for an unparsable %s, without listing', async (field) => {
      for (const value of ['2026-W43', '2026-300', '20261026', '2026-10-26T10']) {
        const res = await request(app.getHttpServer()).get(`${BASE}/${path}`).query({ [field]: value });

        expect({ value, status: res.status, message: res.body.message }).toEqual({ value, status: 400, message: 'Fecha inválida' });
      }
      expect(list).not.toHaveBeenCalled();
    });

    it('answers 400 "Fecha inválida" for text that is not a date', async () => {
      const res = await request(app.getHttpServer()).get(`${BASE}/${path}`).query({ from: 'ayer' });

      expect(res.status).toBe(400);
      expect(res.body.message).toEqual(['Fecha inválida']);
      expect(list).not.toHaveBeenCalled();
    });
  });
});
