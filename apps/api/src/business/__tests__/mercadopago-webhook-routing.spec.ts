import { createHmac } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MercadoPagoWebhookController } from '../mercadopago-webhook.controller';
import { QrChargeSync } from '../use-cases/qr-charge-sync';
import { OnlineCheckoutSync } from '../use-cases/online-checkout-sync';

const SECRET = 'webhook-secret';
const REQUEST_ID = 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e';
const TS = '1704908010000';

const signature = (dataId: string) => {
  const manifest = `id:${dataId.toLowerCase()};request-id:${REQUEST_ID};ts:${TS};`;
  return `ts=${TS},v1=${createHmac('sha256', SECRET).update(manifest).digest('hex')}`;
};

describe('Mercado Pago webhook routing: QR charge or online checkout (S20)', () => {
  const OLD_SECRET = process.env.MP_WEBHOOK_SECRET;
  let app: INestApplication;
  const qrSync = jest.fn();
  const onlineSync = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MercadoPagoWebhookController],
      providers: [
        { provide: QrChargeSync, useValue: { syncByMpOrderId: qrSync } },
        { provide: OnlineCheckoutSync, useValue: { syncByMpOrderId: onlineSync } },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    process.env.MP_WEBHOOK_SECRET = OLD_SECRET;
    await app.close();
  });

  beforeEach(() => {
    process.env.MP_WEBHOOK_SECRET = SECRET;
    qrSync.mockReset();
    onlineSync.mockReset();
  });

  const notify = (dataId: string) =>
    request(app.getHttpServer())
      .post(`/public/mercadopago/webhook?data.id=${dataId}&type=order`)
      .set({ 'x-signature': signature(dataId), 'x-request-id': REQUEST_ID })
      .send({ action: 'order.processed', data: { id: dataId } });

  it('syncs the online checkout when the Mercado Pago order belongs to one, without touching QR charges', async () => {
    onlineSync.mockResolvedValue({ id: 'co-1', status: 'paid' });

    const response = await notify('ORD01ONLINE');

    expect(response.status).toBe(200);
    expect(onlineSync).toHaveBeenCalledWith('ORD01ONLINE');
    expect(qrSync).not.toHaveBeenCalled();
  });

  it('falls back to the QR charge sync for any other order', async () => {
    onlineSync.mockResolvedValue(null);
    qrSync.mockResolvedValue({ id: 'charge-1', status: 'paid' });

    const response = await notify('ORD01QR');

    expect(response.status).toBe(200);
    expect(onlineSync).toHaveBeenCalledWith('ORD01QR');
    expect(qrSync).toHaveBeenCalledWith('ORD01QR');
  });

  it('answers 503 when the online checkout sync fails, so Mercado Pago retries', async () => {
    onlineSync.mockRejectedValue(new Error('Mercado Pago respondió 500'));

    const response = await notify('ORD01ONLINE');

    expect(response.status).toBe(503);
    expect(qrSync).not.toHaveBeenCalled();
  });

  it('checks the signature before any sync', async () => {
    const response = await request(app.getHttpServer()).post('/public/mercadopago/webhook?data.id=ORD01ONLINE&type=order').send({});

    expect(response.status).toBe(401);
    expect(onlineSync).not.toHaveBeenCalled();
    expect(qrSync).not.toHaveBeenCalled();
  });
});
