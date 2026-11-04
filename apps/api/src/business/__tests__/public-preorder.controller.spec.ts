import { Controller, Get, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { NotFoundError } from '@unna/domain';
import { PublicPreorderController } from '../public-preorder.controller';
import { PublicOrderBoardController } from '../public-order-board.controller';
import { publicBoardThrottlerOptions, publicOrderThrottlerOptions } from '../public-board-throttle';
import { PublicMenuUseCase } from '../use-cases/public-menu.use-case';
import { OnlineCheckoutUseCase } from '../use-cases/online-checkout.use-case';
import { OrderTrackingUseCase } from '../use-cases/order-tracking.use-case';
import { OrderBoardUseCase } from '../use-cases/order-board.use-case';

const SLUG = 'Pa_slug-0123456789ab';
const TOKEN = 'T'.repeat(43);
const PRODUCT = 'a0000000-0000-4000-8000-000000000001';
const BODY = { customerName: 'Ana', items: [{ productId: PRODUCT, quantity: 1 }] };

@Controller('unthrottled')
class UnthrottledController {
  @Get()
  ok() {
    return { ok: true };
  }
}

describe('public pedido anticipado routes (S20)', () => {
  describe('publicOrderThrottlerOptions', () => {
    it('allows 30 checkout creations and 120 reads per minute per client by default, under its own names', () => {
      expect(publicOrderThrottlerOptions({})).toEqual([
        { name: 'public-order', ttl: 60_000, limit: 120 },
        { name: 'public-order-checkout', ttl: 60_000, limit: 30 },
      ]);
    });

    it('reads the checkout limit from PUBLIC_ORDER_RATE_LIMIT; reads get four times as many', () => {
      expect(publicOrderThrottlerOptions({ PUBLIC_ORDER_RATE_LIMIT: '10' }).map((o) => o.limit)).toEqual([40, 10]);
    });

    it.each(['0', '-5', 'abc'])('ignores an invalid PUBLIC_ORDER_RATE_LIMIT %p', (value) => {
      expect(publicOrderThrottlerOptions({ PUBLIC_ORDER_RATE_LIMIT: value }).map((o) => o.limit)).toEqual([120, 30]);
    });
  });

  describe('HTTP', () => {
    let app: INestApplication;
    const menu = jest.fn();
    const create = jest.fn();
    const track = jest.fn();
    const publicBoard = jest.fn();

    const start = async (checkoutLimit: string) => {
      const moduleRef = await Test.createTestingModule({
        imports: [ThrottlerModule.forRoot([...publicBoardThrottlerOptions({ PUBLIC_BOARD_RATE_LIMIT: '50' }), ...publicOrderThrottlerOptions({ PUBLIC_ORDER_RATE_LIMIT: checkoutLimit })])],
        controllers: [PublicPreorderController, PublicOrderBoardController, UnthrottledController],
        providers: [
          { provide: PublicMenuUseCase, useValue: { menu } },
          { provide: OnlineCheckoutUseCase, useValue: { create } },
          { provide: OrderTrackingUseCase, useValue: { track } },
          { provide: OrderBoardUseCase, useValue: { publicBoard } },
        ],
      }).compile();
      app = moduleRef.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
      await app.init();
    };
    const server = () => app.getHttpServer();
    const statuses = async (times: number, send: () => request.Test) => {
      const result: number[] = [];
      for (let i = 0; i < times; i++) result.push((await send()).status);
      return result;
    };

    beforeEach(() => {
      for (const fn of [menu, create, track, publicBoard]) fn.mockReset();
      menu.mockResolvedValue({ ok: true, value: { accepting: true } });
      create.mockResolvedValue({ ok: true, value: { trackingToken: TOKEN, checkoutUrl: 'https://mp/checkout', total: 60500 } });
      track.mockResolvedValue({ ok: true, value: { status: 'received' } });
      publicBoard.mockResolvedValue({ ok: true, value: { sucursalName: 'Central', preparing: [], ready: [], updatedAt: '2026-10-26T12:00:00.000Z' } });
    });
    afterEach(() => app.close());

    describe('routes', () => {
      beforeEach(() => start('1000'));

      it('serves the menu without a session and never caches it', async () => {
        const response = await request(server()).get(`/public/pedido/${SLUG}`);

        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(menu).toHaveBeenCalledWith(SLUG);
      });

      it('creates a checkout (201) with the validated body only', async () => {
        const response = await request(server()).post(`/public/pedido/${SLUG}/checkouts`).send(BODY);

        expect(response.status).toBe(201);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body).toEqual({ trackingToken: TOKEN, checkoutUrl: 'https://mp/checkout', total: 60500 });
        expect(create).toHaveBeenCalledWith(SLUG, BODY);
      });

      it.each([
        ['a price sent by the client', { ...BODY, items: [{ productId: PRODUCT, quantity: 1, price: 1 }] }],
        ['a quantity over 20', { ...BODY, items: [{ productId: PRODUCT, quantity: 21 }] }],
        ['more than 30 lines', { ...BODY, items: Array.from({ length: 31 }, () => ({ productId: PRODUCT, quantity: 1 })) }],
        ['a name over 40 chars', { ...BODY, customerName: 'x'.repeat(41) }],
        ['no items', { customerName: 'Ana', items: [] }],
      ])('rejects %s with 400 before the use case', async (_case, body) => {
        const response = await request(server()).post(`/public/pedido/${SLUG}/checkouts`).send(body);

        expect(response.status).toBe(400);
        expect(create).not.toHaveBeenCalled();
      });

      it('maps the use case errors: 404 for unknown links and tokens, 400 with the reason', async () => {
        menu.mockResolvedValue({ ok: false, error: new NotFoundError('Este local no recibe pedidos anticipados') });
        track.mockResolvedValue({ ok: false, error: new NotFoundError('Pedido no encontrado') });
        create.mockResolvedValue({ ok: false, error: new Error('El local está cerrado en este momento') });

        const unknownMenu = await request(server()).get(`/public/pedido/${SLUG}x`);
        const unknownToken = await request(server()).get('/public/pedido/seguimiento/unknown');
        const closed = await request(server()).post(`/public/pedido/${SLUG}/checkouts`).send(BODY);

        expect([unknownMenu.status, unknownMenu.body.message]).toEqual([404, 'Este local no recibe pedidos anticipados']);
        expect([unknownToken.status, unknownToken.body.message]).toEqual([404, 'Pedido no encontrado']);
        expect([closed.status, closed.body.message]).toEqual([400, 'El local está cerrado en este momento']);
      });

      it('serves the tracking page without a session and never caches it', async () => {
        const response = await request(server()).get(`/public/pedido/seguimiento/${TOKEN}`);

        expect(response.status).toBe(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(track).toHaveBeenCalledWith(TOKEN);
      });
    });

    describe('rate limit per client IP (PUBLIC_ORDER_RATE_LIMIT=1: 1 checkout and 4 reads a minute)', () => {
      beforeEach(() => start('1'));

      it('answers 429 over the checkout limit, without calling the use case', async () => {
        expect(await statuses(3, () => request(server()).post(`/public/pedido/${SLUG}/checkouts`).send(BODY))).toEqual([201, 429, 429]);
        expect(create).toHaveBeenCalledTimes(1);
      });

      it('answers 429 over the read limit on the menu and on the tracking page', async () => {
        expect(await statuses(5, () => request(server()).get(`/public/pedido/${SLUG}`))).toEqual([200, 200, 200, 200, 429]);
        expect(await statuses(5, () => request(server()).get(`/public/pedido/seguimiento/${TOKEN}`))).toEqual([200, 200, 200, 200, 429]);
        expect(menu).toHaveBeenCalledTimes(4);
        expect(track).toHaveBeenCalledTimes(4);
      });

      it('does not apply the pedido limits to the public board nor to other routes', async () => {
        expect((await statuses(6, () => request(server()).get(`/public/order-board/${'A'.repeat(43)}`))).every((s) => s === 200)).toBe(true);
        expect((await statuses(6, () => request(server()).get('/unthrottled'))).every((s) => s === 200)).toBe(true);
      });
    });
  });
});
