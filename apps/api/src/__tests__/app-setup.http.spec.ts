import { Controller, Get, INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../app-setup';
import { HealthController } from '../health/health.controller';

// S17: gzip when the client accepts it, and Swagger only outside plain production.

@Controller('big')
class BigController {
  @Get()
  big() {
    return Array.from({ length: 500 }, (_, i) => ({ id: `order-${i}`, status: 'pending', customerName: 'Cliente' }));
  }
}

const start = async (env: NodeJS.ProcessEnv): Promise<INestApplication> => {
  const moduleRef = await Test.createTestingModule({ controllers: [BigController, HealthController] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app, env);
  await app.init();
  return app;
};

describe('configureApp (S17)', () => {
  describe('compression', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await start({ NODE_ENV: 'production' });
    });
    afterAll(() => app.close());

    it('gzips a large response when the client accepts gzip', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/big').set('Accept-Encoding', 'gzip');

      expect(res.status).toBe(200);
      expect(res.headers['content-encoding']).toBe('gzip');
      expect(res.body).toHaveLength(500);
    });

    it('sends it uncompressed when the client does not accept gzip', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/big').set('Accept-Encoding', 'identity');

      expect(res.headers['content-encoding']).toBeUndefined();
      expect(res.body).toHaveLength(500);
    });

    it('does not compress a response under the threshold', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').set('Accept-Encoding', 'gzip');

      expect(res.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('Swagger', () => {
    it.each([
      [{ NODE_ENV: 'production' }, 404],
      [{ NODE_ENV: 'production', UNNA_ENV: 'prod' }, 404],
      [{ NODE_ENV: 'production', UNNA_ENV: 'staging' }, 200],
      [{ NODE_ENV: 'development' }, 200],
    ])('with %p /api/docs answers %p', async (env, status) => {
      const app = await start(env);
      try {
        expect((await request(app.getHttpServer()).get('/api/docs')).status).toBe(status);
      } finally {
        await app.close();
      }
    });
  });
});
