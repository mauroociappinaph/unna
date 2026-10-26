import 'reflect-metadata';
import { GUARDS_METADATA, HTTP_CODE_METADATA, REDIRECT_METADATA } from '@nestjs/common/constants';
import { MercadoPagoController } from '../mercadopago.controller';
import { MercadoPagoOAuthController, mercadoPagoReturnUrl } from '../mercadopago-oauth.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../../common/guards/business-owner.guard';
import type { MercadoPagoAuthorizationUseCase } from '../use-cases/mercadopago-authorization.use-case';
import type { MercadoPagoConnectionUseCase } from '../use-cases/mercadopago-connection.use-case';
import type { MercadoPagoPosUseCase } from '../use-cases/mercadopago-pos.use-case';
import type { AuthenticatedRequest } from '../authenticated-request';
import { fake } from '../use-cases/__tests__/test-doubles';

describe('Mercado Pago controllers (S15)', () => {
  it('guards every owner route with JWT and BusinessOwnerGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MercadoPagoController)).toEqual([JwtAuthGuard, BusinessOwnerGuard]);
  });

  it('starts the connection for the authenticated owner', async () => {
    const authorization = { connect: jest.fn(async () => ({ ok: true, value: { authorizationUrl: 'https://auth' } })) };
    const controller = new MercadoPagoController(fake(authorization), fake({}), fake({}));
    await expect(controller.connect('biz-A', { user: { sub: 'owner-A' } } as AuthenticatedRequest)).resolves.toEqual({ authorizationUrl: 'https://auth' });
    expect(authorization.connect).toHaveBeenCalledWith('biz-A', 'owner-A');
  });

  it('answers 204 on disconnect', async () => {
    const connection = { disconnect: jest.fn(async () => ({ ok: true, value: undefined })) };
    const controller = new MercadoPagoController(fake({}), fake<MercadoPagoConnectionUseCase>(connection), fake<MercadoPagoPosUseCase>({}));
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, MercadoPagoController.prototype.disconnect)).toBe(204);
    await expect(controller.disconnect('biz-A')).resolves.toBeUndefined();
    expect(connection.disconnect).toHaveBeenCalledWith('biz-A');
  });

  it('provisions the POS of the sucursal of the route', async () => {
    const pos = { provision: jest.fn(async () => ({ ok: true, value: { sucursalId: 'suc-1', ready: true, qrImageUrl: 'q', qrTemplateUrl: 't' } })) };
    const controller = new MercadoPagoController(fake({}), fake({}), fake<MercadoPagoPosUseCase>(pos));
    await expect(controller.provisionPos('biz-A', 'suc-1')).resolves.toEqual({ sucursalId: 'suc-1', ready: true, qrImageUrl: 'q', qrTemplateUrl: 't' });
    expect(pos.provision).toHaveBeenCalledWith('biz-A', 'suc-1');
  });

  describe('public OAuth callback', () => {
    const OLD_FRONTEND = process.env.FRONTEND_URL;
    afterEach(() => {
      process.env.FRONTEND_URL = OLD_FRONTEND;
    });

    it('is public (no guards) and redirects with 302', () => {
      expect(Reflect.getMetadata(GUARDS_METADATA, MercadoPagoOAuthController)).toBeUndefined();
      expect(Reflect.getMetadata(REDIRECT_METADATA, MercadoPagoOAuthController.prototype.callback)).toMatchObject({ statusCode: 302 });
    });

    it.each(['connected', 'error'] as const)('redirects to the dashboard with status=%s and never reflects the code or state', async (status) => {
      process.env.FRONTEND_URL = 'https://app.unna.test/';
      const authorization = { complete: jest.fn(async () => status) };
      const controller = new MercadoPagoOAuthController(fake<MercadoPagoAuthorizationUseCase>(authorization));
      const result = await controller.callback('TG-secret-code', 'S'.repeat(43), undefined);
      expect(result).toEqual({ url: `https://app.unna.test/dashboard/mercadopago?status=${status}`, statusCode: 302 });
      expect(result.url).not.toMatch(/TG-secret-code|SSSS/);
      expect(authorization.complete).toHaveBeenCalledWith({ code: 'TG-secret-code', state: 'S'.repeat(43), error: undefined });
    });

    it('redirects with status=error when anything throws', async () => {
      const controller = new MercadoPagoOAuthController(fake<MercadoPagoAuthorizationUseCase>({ complete: jest.fn(async () => { throw new Error('db down'); }) }));
      await expect(controller.callback('c', 's', undefined)).resolves.toMatchObject({ url: expect.stringMatching(/\?status=error$/) });
    });

    it('defaults FRONTEND_URL to the local web app', () => {
      expect(mercadoPagoReturnUrl('connected', {})).toBe('http://localhost:3000/dashboard/mercadopago?status=connected');
    });
  });
});
