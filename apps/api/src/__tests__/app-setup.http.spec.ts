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

const WEB = 'https://web.unna.test';

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
      app = await start({ NODE_ENV: 'production', FRONTEND_URL: WEB });
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
      [{ NODE_ENV: 'production', FRONTEND_URL: WEB }, 404],
      [{ NODE_ENV: 'production', UNNA_ENV: 'prod', FRONTEND_URL: WEB }, 404],
      [{ NODE_ENV: 'production', UNNA_ENV: 'staging', FRONTEND_URL: WEB }, 200],
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

  describe('FRONTEND_URL', () => {
    it.each([{ NODE_ENV: 'production' }, { NODE_ENV: 'production', UNNA_ENV: 'staging' }])('refuses to start without it in production (%p)', async (env) => {
      await expect(start(env)).rejects.toThrow('Falta FRONTEND_URL');
    });

    it('allows CORS only from the web, also when FRONTEND_URL has a trailing slash', async () => {
      const app = await start({ NODE_ENV: 'production', FRONTEND_URL: `${WEB}/` });
      try {
        const res = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', WEB);
        expect(res.headers['access-control-allow-origin']).toBe(WEB);
      } finally {
        await app.close();
      }
    });

    it('allows the local web app outside production', async () => {
      const app = await start({ NODE_ENV: 'development' });
      try {
        const res = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', 'http://localhost:3000');
        expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      } finally {
        await app.close();
      }
    });
  });
});
