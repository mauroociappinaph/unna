import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { MercadoPagoGatewayPort } from '@unna/domain';
import { MercadoPagoSimulatorController, MercadoPagoSimulatorOwnerController, mercadoPagoSimulatorControllers } from '../mercadopago-simulator.controller';
import { MercadoPagoSimulatorAdapter } from '../adapters/mercadopago/mercadopago-simulator.adapter';
import { MercadoPagoHttpAdapter } from '../adapters/mercadopago/mercadopago-http.adapter';
import { QrChargeSync } from '../use-cases/qr-charge-sync';

const CHARGE = {
  id: 'charge-1', businessId: 'biz-A', orderId: 'order-1', sucursalId: 'suc-1', amount: 12345, status: 'paid', mpOrderId: 'x',
  mpPaymentId: 'PAY', qrData: 'qr', expiresAt: new Date('2026-10-25T12:15:00Z'), paidAt: new Date('2026-10-25T12:01:00Z'),
  paymentId: 'pay-1', paymentError: null, createdAt: new Date('2026-10-25T12:00:00Z'),
};

describe('Mercado Pago simulator route (S15)', () => {
  describe('registration', () => {
    it('is registered only for the simulator outside production', () => {
      expect(mercadoPagoSimulatorControllers({ NODE_ENV: 'development' })).toEqual([MercadoPagoSimulatorController, MercadoPagoSimulatorOwnerController]);
      expect(mercadoPagoSimulatorControllers({ NODE_ENV: 'production' })).toEqual([]);
      expect(mercadoPagoSimulatorControllers({ NODE_ENV: 'development', MP_CLIENT_ID: 'id', MP_CLIENT_SECRET: 'secret' })).toEqual([]);
    });

    it('is registered in production with UNNA_ENV=staging (S16)', () => {
      expect(mercadoPagoSimulatorControllers({ NODE_ENV: 'production', UNNA_ENV: 'staging' })).toEqual([MercadoPagoSimulatorController, MercadoPagoSimulatorOwnerController]);
      expect(mercadoPagoSimulatorControllers({ NODE_ENV: 'production', UNNA_ENV: 'staging', MP_CLIENT_ID: 'id', MP_CLIENT_SECRET: 'secret' })).toEqual([]);
    });

    it.each(['Staging', 'prod', ''])('is not registered in production with UNNA_ENV=%p (S16)', (unnaEnv) => {
      expect(mercadoPagoSimulatorControllers({ NODE_ENV: 'production', UNNA_ENV: unnaEnv })).toEqual([]);
    });
  });

  describe('HTTP', () => {
    const OLD_ENV = process.env.NODE_ENV;
    const OLD_UNNA_ENV = process.env.UNNA_ENV;
    let app: INestApplication | undefined;
    const syncByMpOrderId = jest.fn();

    const start = async (gateway: MercadoPagoGatewayPort, controllers: Type[] = [MercadoPagoSimulatorController]) => {
      const moduleRef = await Test.createTestingModule({
        controllers,
        providers: [{ provide: 'MercadoPagoGatewayPort', useValue: gateway }, { provide: QrChargeSync, useValue: { syncByMpOrderId } }],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
      return app;
    };
    const pay = (id: string) => request(app!.getHttpServer()).post(`/mercadopago/simulator/orders/${id}/pay`);

    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      delete process.env.UNNA_ENV;
      syncByMpOrderId.mockReset();
    });
    afterEach(async () => {
      process.env.NODE_ENV = OLD_ENV;
      if (OLD_UNNA_ENV === undefined) delete process.env.UNNA_ENV;
      else process.env.UNNA_ENV = OLD_UNNA_ENV;
      await app?.close();
      app = undefined;
    });

    it('marks the simulated order paid and runs the same sync as the webhook', async () => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost/cb');
      const order = await simulator.createQrOrder('', { externalReference: 'r', externalPosId: 'p', amount: 12345, description: 'd', expirationTime: 'PT15M', idempotencyKey: 'k' });
      syncByMpOrderId.mockResolvedValue({ ...CHARGE, mpOrderId: order.id });
      await start(simulator);

      const response = await pay(order.id);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: 'charge-1', status: 'paid', paymentRegistered: true });
      expect((await simulator.getOrder('', order.id)).status).toBe('processed');
      expect(syncByMpOrderId).toHaveBeenCalledWith(order.id);
    });

    it('answers 404 for an unknown or already paid simulated order', async () => {
      await start(new MercadoPagoSimulatorAdapter('http://localhost/cb'));

      expect((await pay('ORD-UNKNOWN')).status).toBe(404);
      expect(syncByMpOrderId).not.toHaveBeenCalled();
    });

    it('answers 404 when the real gateway is wired, without calling it', async () => {
      const fetchImpl = jest.fn();
      await start(new MercadoPagoHttpAdapter({ clientId: 'id', clientSecret: 's', redirectUri: 'https://x/cb' }, fetchImpl));

      expect((await pay('ORD1')).status).toBe(404);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(syncByMpOrderId).not.toHaveBeenCalled();
    });

    it('answers 404 in production even with the simulator', async () => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost/cb');
      const order = await simulator.createQrOrder('', { externalReference: 'r', externalPosId: 'p', amount: 1, description: 'd', expirationTime: 'PT15M', idempotencyKey: 'k' });
      await start(simulator);
      process.env.NODE_ENV = 'production';

      expect((await pay(order.id)).status).toBe(404);
      expect((await simulator.getOrder('', order.id)).status).toBe('created');
    });

    it('pays a simulated order in production with UNNA_ENV=staging (S16)', async () => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost/cb');
      const order = await simulator.createQrOrder('', { externalReference: 'r', externalPosId: 'p', amount: 1, description: 'd', expirationTime: 'PT15M', idempotencyKey: 'k' });
      syncByMpOrderId.mockResolvedValue({ ...CHARGE, mpOrderId: order.id });
      const staging = { NODE_ENV: 'production', UNNA_ENV: 'staging' };
      // Only the buyer route: the owner route needs the auth guards' providers (covered in its own spec).
      await start(simulator, mercadoPagoSimulatorControllers(staging).slice(0, 1));
      Object.assign(process.env, staging);

      const response = await pay(order.id);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: 'charge-1', status: 'paid' });
      expect((await simulator.getOrder('', order.id)).status).toBe('processed');
      expect(syncByMpOrderId).toHaveBeenCalledWith(order.id);
    });

    it.each(['Staging', 'prod'])('answers 404 in production with UNNA_ENV=%p even with the simulator (S16)', async (unnaEnv) => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost/cb');
      const order = await simulator.createQrOrder('', { externalReference: 'r', externalPosId: 'p', amount: 1, description: 'd', expirationTime: 'PT15M', idempotencyKey: 'k' });
      await start(simulator);
      Object.assign(process.env, { NODE_ENV: 'production', UNNA_ENV: unnaEnv });

      expect((await pay(order.id)).status).toBe(404);
      expect((await simulator.getOrder('', order.id)).status).toBe('created');
      expect(syncByMpOrderId).not.toHaveBeenCalled();
    });

    it('does not exist when the module is built for production', async () => {
      await start(new MercadoPagoSimulatorAdapter('http://localhost/cb'), mercadoPagoSimulatorControllers({ NODE_ENV: 'production' }));

      expect((await pay('ORD1')).status).toBe(404);
    });
  });
});
