import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../../app-setup';
import { HealthController } from '../health.controller';

describe('GET /api/v1/health (S17)', () => {
  let app: INestApplication;

  // No provider at all is registered: the check cannot reach the database.
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, { NODE_ENV: 'production', FRONTEND_URL: 'https://web.test' });
    await app.init();
  });

  afterAll(() => app.close());

  it('answers 200 { status: "ok" } without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('needs no dependency and has no guard (no auth, no throttling)', () => {
    expect(HealthController.length).toBe(0);
    expect(Reflect.getMetadata(GUARDS_METADATA, HealthController)).toBeUndefined();
    expect(Reflect.getMetadata(GUARDS_METADATA, HealthController.prototype.check)).toBeUndefined();
  });
});
