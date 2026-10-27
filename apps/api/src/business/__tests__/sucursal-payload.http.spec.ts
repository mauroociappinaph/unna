import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../../app-setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessController } from '../business.controller';
import { BusinessManagementUseCase } from '../use-cases/business-management.use-case';
import { OnboardBusinessUseCase } from '../use-cases/onboard-business.use-case';

// S21: the web sent `{ action, sucursal: {...} }`, while ManageSucursalDto takes the fields at the
// top level and rejects unknown ones, so every create and update from /dashboard/sucursales was a 400.
const day = { open: '09:00', close: '18:00', isClosed: false };
const week = { monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: { ...day, isClosed: true } };
const address = { street: 'Corrientes', number: '1234', floor: '', apartment: '', neighborhood: '', city: 'CABA', province: 'Buenos Aires', postalCode: '1043', country: 'Argentina' };
const fields = { name: 'Palermo', address, phone: '1145678901', email: 'palermo@unna.test', schedule: week, isMain: false, isActive: true };
const BASE = '/api/v1/businesses/biz-A/sucursales';

describe('sucursal create/update payload over HTTP (S21)', () => {
  let app: INestApplication;
  const management = { manageSucursal: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BusinessController],
      providers: [
        { provide: BusinessManagementUseCase, useValue: management },
        { provide: OnboardBusinessUseCase, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
        context.switchToHttp().getRequest().user = { sub: 'owner-1' };
        return true;
      } })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app as NestExpressApplication, { NODE_ENV: 'production', FRONTEND_URL: 'https://web.test' });
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => management.manageSucursal.mockReset().mockResolvedValue({ ok: true, value: { id: 'biz-A' } }));

  it('rejects the nested body the web used to send, without touching the business', async () => {
    const created = await request(app.getHttpServer()).post(BASE).send({ action: 'create', sucursal: fields });
    const updated = await request(app.getHttpServer()).put(`${BASE}/suc-2`).send({ action: 'update', sucursal: { ...fields, id: 'suc-2' } });

    expect([created.status, updated.status]).toEqual([400, 400]);
    expect(management.manageSucursal).not.toHaveBeenCalled();
  });

  it('creates a sucursal from the fields at the top level', async () => {
    const response = await request(app.getHttpServer()).post(BASE).send({ action: 'create', ...fields });

    expect(response.status).toBe(201);
    expect(management.manageSucursal).toHaveBeenCalledWith({
      businessId: 'biz-A',
      ownerId: 'owner-1',
      action: 'create',
      sucursal: expect.objectContaining(fields),
    });
  });

  it('updates the sucursal of the path from the fields at the top level', async () => {
    const response = await request(app.getHttpServer()).put(`${BASE}/suc-2`).send({ action: 'update', ...fields });

    expect(response.status).toBe(200);
    expect(management.manageSucursal).toHaveBeenCalledWith({
      businessId: 'biz-A',
      ownerId: 'owner-1',
      action: 'update',
      sucursal: expect.objectContaining({ ...fields, id: 'suc-2' }),
    });
  });

  it('rejects the read-only fields of a listed sucursal (id, timestamps, formatted address)', async () => {
    const listed = { ...fields, id: 'suc-2', address: { ...address, formatted: 'Corrientes 1234, CABA' }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

    const response = await request(app.getHttpServer()).put(`${BASE}/suc-2`).send({ action: 'update', ...listed });

    expect(response.status).toBe(400);
    expect(management.manageSucursal).not.toHaveBeenCalled();
  });
});
