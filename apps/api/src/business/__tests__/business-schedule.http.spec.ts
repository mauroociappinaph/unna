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

// S21: the business schedule and a sucursal's schedule have their own routes; before, both were
// `PATCH businesses/:id/schedule` and Express always ran the first one.
const day = { open: '09:00', close: '18:00', isClosed: false };
const week = { monday: day, tuesday: day, wednesday: day, thursday: day, friday: day, saturday: day, sunday: { ...day, isClosed: true } };
const BASE = '/api/v1/businesses/biz-A';

describe('schedule routes over HTTP (S21)', () => {
  let app: INestApplication;
  const management = { updateSchedule: jest.fn(), manageHorarios: jest.fn() };

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
    management.updateSchedule.mockReset().mockResolvedValue({ ok: true, value: { id: 'biz-A' } });
    management.manageHorarios.mockReset().mockResolvedValue({ ok: true, value: { id: 'biz-A' } });
  });

  it('PATCH /businesses/:id/schedule updates the business schedule', async () => {
    const response = await request(app.getHttpServer()).patch(`${BASE}/schedule`).send(week);

    expect(response.status).toBe(200);
    expect(management.updateSchedule).toHaveBeenCalledWith({ businessId: 'biz-A', ownerId: 'owner-1', schedule: week });
    expect(management.manageHorarios).not.toHaveBeenCalled();
  });

  it('the business route does not take a sucursal', async () => {
    const response = await request(app.getHttpServer()).patch(`${BASE}/schedule`).send({ sucursalId: 'suc-2', schedule: week });

    expect(response.status).toBe(400);
    expect([management.updateSchedule, management.manageHorarios].map((fn) => fn.mock.calls.length)).toEqual([0, 0]);
  });

  it('PATCH /businesses/:id/sucursales/:sucursalId/schedule updates that sucursal schedule', async () => {
    const response = await request(app.getHttpServer()).patch(`${BASE}/sucursales/suc-2/schedule`).send(week);

    expect(response.status).toBe(200);
    expect(management.manageHorarios).toHaveBeenCalledWith({ businessId: 'biz-A', ownerId: 'owner-1', sucursalId: 'suc-2', schedule: week });
    expect(management.updateSchedule).not.toHaveBeenCalled();
  });

  it('answers 404 for a sucursal of another business', async () => {
    management.manageHorarios.mockResolvedValue({ ok: false, error: new NotFoundError('Sucursal no encontrada') });

    const response = await request(app.getHttpServer()).patch(`${BASE}/sucursales/suc-B/schedule`).send(week);

    expect([response.status, response.body.message]).toEqual([404, 'Sucursal no encontrada']);
  });

  it('rejects a sucursal schedule with fields outside the week', async () => {
    const response = await request(app.getHttpServer()).patch(`${BASE}/sucursales/suc-2/schedule`).send({ sucursalId: 'suc-2', schedule: week });

    expect(response.status).toBe(400);
    expect(management.manageHorarios).not.toHaveBeenCalled();
  });
});
