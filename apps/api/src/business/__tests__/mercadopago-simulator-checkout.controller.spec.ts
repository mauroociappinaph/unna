import { INestApplication, Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { CreateMercadoPagoOnlineOrderRequest, MercadoPagoGatewayPort } from '@unna/domain';
import { MercadoPagoSimulatorCheckoutController, onlineCheckoutSimulatorControllers } from '../mercadopago-simulator-checkout.controller';
import { MercadoPagoSimulatorAdapter } from '../adapters/mercadopago/mercadopago-simulator.adapter';
import { MercadoPagoHttpAdapter } from '../adapters/mercadopago/mercadopago-http.adapter';
import { OnlineCheckoutSync } from '../use-cases/online-checkout-sync';

const SUCCESS = 'http://localhost:3000/pedido/seguimiento/TOKEN';
const ORDER: CreateMercadoPagoOnlineOrderRequest = {
  externalReference: 'UNNAPAabc', amount: 60500, items: [{ title: 'Medialuna', quantity: 1, unitPrice: 60500 }], expirationTime: 'PT15M',
  successUrl: SUCCESS, failureUrl: SUCCESS, pendingUrl: SUCCESS, idempotencyKey: 'key-1',
};

describe('Mercado Pago simulator checkout of the pedido anticipado (S20)', () => {
  describe('registration', () => {
    it('exists only with the simulator outside production or in staging', () => {
      expect(onlineCheckoutSimulatorControllers({ NODE_ENV: 'development' })).toEqual([MercadoPagoSimulatorCheckoutController]);
      expect(onlineCheckoutSimulatorControllers({ NODE_ENV: 'production', UNNA_ENV: 'staging' })).toEqual([MercadoPagoSimulatorCheckoutController]);
      expect(onlineCheckoutSimulatorControllers({ NODE_ENV: 'production' })).toEqual([]);
      expect(onlineCheckoutSimulatorControllers({ NODE_ENV: 'development', MP_CLIENT_ID: 'id', MP_CLIENT_SECRET: 'secret' })).toEqual([]);
    });
  });

  describe('HTTP', () => {
    const OLD_ENV = process.env.NODE_ENV;
    let app: INestApplication | undefined;
    const syncByMpOrderId = jest.fn();

    const start = async (gateway: MercadoPagoGatewayPort, controllers: Type[] = [MercadoPagoSimulatorCheckoutController]) => {
      const moduleRef = await Test.createTestingModule({
        controllers,
        providers: [{ provide: 'MercadoPagoGatewayPort', useValue: gateway }, { provide: OnlineCheckoutSync, useValue: { syncByMpOrderId } }],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();
    };
    const pay = (id: string) => request(app!.getHttpServer()).get(`/mercadopago/simulator/checkout/${id}`);

    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      syncByMpOrderId.mockReset();
      syncByMpOrderId.mockResolvedValue({ id: 'co-1', status: 'paid' });
    });
    afterEach(async () => {
      process.env.NODE_ENV = OLD_ENV;
      await app?.close();
      app = undefined;
    });

    it('marks the simulated order paid, runs the same sync as the webhook and redirects (302) to the success URL', async () => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost:3001/cb');
      const order = await simulator.createOnlineOrder('', ORDER);
      await start(simulator);

      const response = await pay(order.id);

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe(SUCCESS);
      expect((await simulator.getOrder('', order.id)).status).toBe('processed');
      expect(syncByMpOrderId).toHaveBeenCalledWith(order.id);
    });

    it('redirects again when the paid checkout is opened twice, without paying twice', async () => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost:3001/cb');
      const order = await simulator.createOnlineOrder('', ORDER);
      await start(simulator);

      await pay(order.id);
      const again = await pay(order.id);

      expect(again.status).toBe(302);
      expect(again.headers.location).toBe(SUCCESS);
    });

    it('answers 404 for an unknown order or one that is not an online checkout', async () => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost:3001/cb');
      await start(simulator);
      syncByMpOrderId.mockResolvedValue(null);

      expect((await pay('ORD-UNKNOWN')).status).toBe(404);
      expect(syncByMpOrderId).not.toHaveBeenCalled();
    });

    it('answers 404 with the real gateway, without calling it', async () => {
      const fetchImpl = jest.fn();
      await start(new MercadoPagoHttpAdapter({ clientId: 'id', clientSecret: 's', redirectUri: 'https://x/cb' }, fetchImpl));

      expect((await pay('ORD1')).status).toBe(404);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('answers 404 in production even with the simulator', async () => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost:3001/cb');
      const order = await simulator.createOnlineOrder('', ORDER);
      await start(simulator);
      process.env.NODE_ENV = 'production';

      expect((await pay(order.id)).status).toBe(404);
      expect((await simulator.getOrder('', order.id)).status).toBe('created');
    });

    it('does not exist when the module is built for plain production', async () => {
      await start(new MercadoPagoSimulatorAdapter('http://localhost:3001/cb'), onlineCheckoutSimulatorControllers({ NODE_ENV: 'production' }));

      expect((await pay('ORD1')).status).toBe(404);
    });
  });
});
