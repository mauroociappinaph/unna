import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { NotFoundException } from '@nestjs/common';
import { MercadoPagoSimulatorOwnerController } from '../mercadopago-simulator.controller';
import { MercadoPagoSimulatorAdapter } from '../adapters/mercadopago/mercadopago-simulator.adapter';
import { MercadoPagoHttpAdapter } from '../adapters/mercadopago/mercadopago-http.adapter';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BusinessOwnerGuard } from '../../common/guards/business-owner.guard';
import type { QrChargeSync } from '../use-cases/qr-charge-sync';
import { fake } from '../use-cases/__tests__/test-doubles';

const charge = (mpOrderId: string) => ({
  id: 'charge-1', businessId: 'biz-A', orderId: 'order-1', sucursalId: 'suc-1', amount: 100, status: 'pending', mpOrderId,
  mpPaymentId: null, qrData: 'qr', expiresAt: new Date('2026-10-25T12:15:00Z'), paidAt: null, paymentId: null, paymentError: null,
  createdAt: new Date('2026-10-25T12:00:00Z'),
});

describe('Simulated payment of a QR charge from the POS (S15, simulator only)', () => {
  const OLD_ENV = process.env.NODE_ENV;
  const OLD_UNNA_ENV = process.env.UNNA_ENV;
  beforeEach(() => { delete process.env.UNNA_ENV; });
  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
    if (OLD_UNNA_ENV === undefined) delete process.env.UNNA_ENV;
    else process.env.UNNA_ENV = OLD_UNNA_ENV;
  });

  const setup = async (gateway = new MercadoPagoSimulatorAdapter('http://localhost/cb')) => {
    const order = gateway instanceof MercadoPagoSimulatorAdapter
      ? await gateway.createQrOrder('', { externalReference: 'r', externalPosId: 'p', amount: 100, description: 'd', expirationTime: 'PT15M', idempotencyKey: 'k' })
      : { id: 'ORD1' };
    const findById = jest.fn(async (businessId: string) => (businessId === 'biz-A' ? charge(order.id) : null));
    const syncByMpOrderId = jest.fn(async () => ({ ...charge(order.id), status: 'paid', paymentId: 'pay-1', paidAt: new Date('2026-10-25T12:01:00Z') }));
    const controller = new MercadoPagoSimulatorOwnerController(gateway, fake({ findById }), fake<QrChargeSync>({ syncByMpOrderId }));
    return { controller, gateway, order, findById, syncByMpOrderId };
  };

  it('is guarded by JWT and BusinessOwnerGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MercadoPagoSimulatorOwnerController)).toEqual([JwtAuthGuard, BusinessOwnerGuard]);
  });

  it('pays the simulated order of a charge of the business and runs the webhook sync', async () => {
    process.env.NODE_ENV = 'test';
    const { controller, gateway, order, findById, syncByMpOrderId } = await setup();

    await expect(controller.pay('biz-A', 'charge-1')).resolves.toMatchObject({ id: 'charge-1', status: 'paid', paymentRegistered: true, simulated: true });

    expect(findById).toHaveBeenCalledWith('biz-A', 'charge-1');
    expect((await (gateway as MercadoPagoSimulatorAdapter).getOrder('', order.id)).status).toBe('processed');
    expect(syncByMpOrderId).toHaveBeenCalledWith(order.id);
  });

  it('answers 404 for a charge of another business without paying anything', async () => {
    process.env.NODE_ENV = 'test';
    const { controller, gateway, order, syncByMpOrderId } = await setup();

    await expect(controller.pay('biz-B', 'charge-1')).rejects.toBeInstanceOf(NotFoundException);
    expect((await (gateway as MercadoPagoSimulatorAdapter).getOrder('', order.id)).status).toBe('created');
    expect(syncByMpOrderId).not.toHaveBeenCalled();
  });

  it('answers 404 with the real gateway or in production', async () => {
    process.env.NODE_ENV = 'test';
    const real = await setup(new MercadoPagoHttpAdapter({ clientId: 'id', clientSecret: 's', redirectUri: 'https://x/cb' }, jest.fn()) as never);
    await expect(real.controller.pay('biz-A', 'charge-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(real.syncByMpOrderId).not.toHaveBeenCalled();

    const sim = await setup();
    process.env.NODE_ENV = 'production';
    await expect(sim.controller.pay('biz-A', 'charge-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(sim.syncByMpOrderId).not.toHaveBeenCalled();
  });

  it('pays in production with UNNA_ENV=staging (S16)', async () => {
    const { controller, gateway, order, syncByMpOrderId } = await setup();
    Object.assign(process.env, { NODE_ENV: 'production', UNNA_ENV: 'staging' });

    await expect(controller.pay('biz-A', 'charge-1')).resolves.toMatchObject({ id: 'charge-1', status: 'paid', simulated: true });
    expect((await (gateway as MercadoPagoSimulatorAdapter).getOrder('', order.id)).status).toBe('processed');
    expect(syncByMpOrderId).toHaveBeenCalledWith(order.id);
  });

  it.each(['Staging', 'prod'])('answers 404 in production with UNNA_ENV=%p (S16)', async (unnaEnv) => {
    const { controller, gateway, order, syncByMpOrderId } = await setup();
    Object.assign(process.env, { NODE_ENV: 'production', UNNA_ENV: unnaEnv });

    await expect(controller.pay('biz-A', 'charge-1')).rejects.toBeInstanceOf(NotFoundException);
    expect((await (gateway as MercadoPagoSimulatorAdapter).getOrder('', order.id)).status).toBe('created');
    expect(syncByMpOrderId).not.toHaveBeenCalled();
  });
});
