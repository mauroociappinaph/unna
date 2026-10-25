import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { PublicOrderBoardController } from '../public-order-board.controller';
import { OrderBoardUseCase } from '../use-cases/order-board.use-case';
import { publicBoardThrottlerOptions, trustProxyHops } from '../public-board-throttle';

const TOKEN = 'A'.repeat(43);

@Controller('unthrottled')
class UnthrottledController {
  @Get()
  ok() {
    return { ok: true };
  }
}

describe('public order board rate limit', () => {
  describe('publicBoardThrottlerOptions', () => {
    it('allows 120 requests per minute per client by default', () => {
      expect(publicBoardThrottlerOptions({})).toEqual([{ name: 'public-board', ttl: 60_000, limit: 120 }]);
    });

    it('reads the limit from PUBLIC_BOARD_RATE_LIMIT', () => {
      expect(publicBoardThrottlerOptions({ PUBLIC_BOARD_RATE_LIMIT: '30' })[0].limit).toBe(30);
    });

    it.each(['0', '-5', 'abc'])('ignores an invalid PUBLIC_BOARD_RATE_LIMIT %p', (value) => {
      expect(publicBoardThrottlerOptions({ PUBLIC_BOARD_RATE_LIMIT: value })[0].limit).toBe(120);
    });
  });

  describe('trustProxyHops', () => {
    it('returns the configured number of proxies', () => {
      expect(trustProxyHops({ TRUST_PROXY: '1' })).toBe(1);
    });

    it.each([undefined, '', '0', 'yes'])('is undefined for %p', (value) => {
      expect(trustProxyHops({ TRUST_PROXY: value })).toBeUndefined();
    });
  });

  describe('HTTP', () => {
    let app: INestApplication;
    const publicBoard = jest.fn();

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [ThrottlerModule.forRoot(publicBoardThrottlerOptions({ PUBLIC_BOARD_RATE_LIMIT: '3' }))],
        controllers: [PublicOrderBoardController, UnthrottledController],
        providers: [{ provide: OrderBoardUseCase, useValue: { publicBoard } }],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    });

    afterAll(() => app.close());

    beforeEach(() => {
      publicBoard.mockReset();
      publicBoard.mockResolvedValue({ ok: true, value: { sucursalName: 'Central', preparing: [], ready: [], updatedAt: '2026-10-25T12:00:00.000Z' } });
    });

    it('answers 429 once a client goes over the limit, without calling the use case', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) statuses.push((await request(app.getHttpServer()).get(`/public/order-board/${TOKEN}`)).status);

      expect(statuses).toEqual([200, 200, 200, 429]);
      expect(publicBoard).toHaveBeenCalledTimes(3);
    });

    it('does not limit other routes', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) statuses.push((await request(app.getHttpServer()).get('/unthrottled')).status);

      expect(statuses.every((s) => s === 200)).toBe(true);
    });
  });
});
