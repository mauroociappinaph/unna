import 'reflect-metadata';
import { CanActivate, INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { NotFoundError } from '@unna/domain';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../../common/guards/business-owner.guard';
import { PreorderController } from '../preorder.controller';
import { PreorderSettingsUseCase } from '../use-cases/preorder-settings.use-case';

const allow: CanActivate = { canActivate: () => true };

describe('PreorderController: owner routes of the pedido anticipado (S20)', () => {
  let app: INestApplication;
  const settings = { list: jest.fn(), enable: jest.fn(), disable: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PreorderController],
      providers: [{ provide: PreorderSettingsUseCase, useValue: settings }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allow)
      .overrideGuard(BusinessOwnerGuard).useValue(allow)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => Object.values(settings).forEach((fn) => fn.mockReset()));

  it('requires the JWT and the business owner', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, PreorderController)).toEqual([JwtAuthGuard, BusinessOwnerGuard]);
  });

  it('lists, enables and disables (204)', async () => {
    settings.list.mockResolvedValue({ ok: true, value: { sucursales: [] } });
    settings.enable.mockResolvedValue({ ok: true, value: { sucursalId: 'suc-1', enabled: true, slug: 's', url: 'u' } });
    settings.disable.mockResolvedValue({ ok: true });
    const server = app.getHttpServer();

    const list = await request(server).get('/businesses/biz-A/pedido-anticipado');
    const enable = await request(server).post('/businesses/biz-A/sucursales/suc-1/pedido-anticipado');
    const disable = await request(server).delete('/businesses/biz-A/sucursales/suc-1/pedido-anticipado');

    expect([list.status, list.body]).toEqual([200, { sucursales: [] }]);
    expect([enable.status, enable.body]).toEqual([201, { sucursalId: 'suc-1', enabled: true, slug: 's', url: 'u' }]);
    expect(disable.status).toBe(204);
    expect(settings.enable).toHaveBeenCalledWith('biz-A', 'suc-1');
    expect(settings.disable).toHaveBeenCalledWith('biz-A', 'suc-1');
  });

  it('answers 404 for a sucursal of another business', async () => {
    settings.disable.mockResolvedValue({ ok: false, error: new NotFoundError('Sucursal no encontrada') });

    const response = await request(app.getHttpServer()).delete('/businesses/biz-A/sucursales/suc-B/pedido-anticipado');

    expect([response.status, response.body.message]).toEqual([404, 'Sucursal no encontrada']);
  });
});
