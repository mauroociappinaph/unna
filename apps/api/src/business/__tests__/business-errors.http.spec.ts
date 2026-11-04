import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { NotFoundError } from '@unna/domain';
import { configureApp } from '../../app-setup';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessController } from '../business.controller';
import { BusinessManagementUseCase } from '../use-cases/business-management.use-case';
import { OnboardBusinessUseCase } from '../use-cases/onboard-business.use-case';

// Business edits answered every failure as 400 and let value-object errors escape as 500:
// they now go through unwrap, so a missing business is 404 and an invalid value is 400.
const day = { open: '09:00', close: '18:00', isClosed: false };
const week = { monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: { ...day, isClosed: true } };
const address = { street: 'Corrientes', number: '1234', city: 'CABA', province: 'Buenos Aires', postalCode: '1043', country: 'Argentina' };
const fields = { name: 'Palermo', address, phone: '1145678901', email: 'palermo@unna.test' };
const BASE = '/api/v1/businesses/biz-A';

describe('business edit errors over HTTP', () => {
  let app: INestApplication;
  const management = { updateSchedule: jest.fn(), manageSucursal: jest.fn() };

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

  beforeEach(() => {
    management.updateSchedule.mockReset();
    management.manageSucursal.mockReset();
  });

  it('answers a value-object error thrown by the use case as 400 with its message', async () => {
    management.updateSchedule.mockRejectedValue(new Error('Hora de apertura debe ser anterior a hora de cierre para monday'));

    const response = await request(app.getHttpServer()).patch(`${BASE}/schedule`).send(week);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Hora de apertura debe ser anterior a hora de cierre para monday');
  });

  it('answers a business that is not found as 404', async () => {
    management.manageSucursal.mockResolvedValue({ ok: false, error: new NotFoundError('Negocio no encontrado') });

    const response = await request(app.getHttpServer()).put(`${BASE}/sucursales/suc-2`).send({ action: 'update', ...fields });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Negocio no encontrado');
  });

  it('keeps answering other failed results as 400 with their message', async () => {
    management.manageSucursal.mockResolvedValue({ ok: false, error: new Error('ID de sucursal requerido para actualizar') });

    const response = await request(app.getHttpServer()).put(`${BASE}/sucursales/suc-2`).send({ action: 'update', ...fields });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('ID de sucursal requerido para actualizar');
  });
});
