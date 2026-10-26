import 'reflect-metadata';
import { createHmac } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { MercadoPagoWebhookController } from '../mercadopago-webhook.controller';
import { QrChargeSync } from '../use-cases/qr-charge-sync';

const SECRET = 'webhook-secret';
const ORDER_ID = 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3';
const REQUEST_ID = 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e';
const TS = '1704908010000';

const signature = (dataId = ORDER_ID, requestId = REQUEST_ID) => {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${TS};`;
  return `ts=${TS},v1=${createHmac('sha256', SECRET).update(manifest).digest('hex')}`;
};

describe('POST /public/mercadopago/webhook (S15)', () => {
  const OLD_SECRET = process.env.MP_WEBHOOK_SECRET;
  let app: INestApplication;
  const syncByMpOrderId = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MercadoPagoWebhookController],
      providers: [{ provide: QrChargeSync, useValue: { syncByMpOrderId } }],
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
    syncByMpOrderId.mockReset();
    syncByMpOrderId.mockResolvedValue({ id: 'charge-1', status: 'paid' });
  });

  const post = (headers: Record<string, string>, dataId = ORDER_ID, body: object = { action: 'order.processed', data: { id: dataId } }) =>
    request(app.getHttpServer()).post(`/public/mercadopago/webhook?data.id=${dataId}&type=order`).set(headers).send(body);

  it('is public: no auth guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MercadoPagoWebhookController)).toBeUndefined();
  });

  it('answers 200 to a valid signature and syncs the order of the query, as Mercado Pago sent it', async () => {
    const response = await post({ 'x-signature': signature(), 'x-request-id': REQUEST_ID });

    expect(response.status).toBe(200);
    expect(syncByMpOrderId).toHaveBeenCalledTimes(1);
    expect(syncByMpOrderId).toHaveBeenCalledWith(ORDER_ID);
  });

  it('never trusts the body: only the signed data.id of the query reaches the sync', async () => {
    const response = await post(
      { 'x-signature': signature(), 'x-request-id': REQUEST_ID },
      ORDER_ID,
      { action: 'order.processed', data: { id: 'ORD-FORGED', status: 'processed', total_amount: '999999.00' } },
    );

    expect(response.status).toBe(200);
    expect(syncByMpOrderId.mock.calls).toEqual([[ORDER_ID]]);
  });

  it('answers 200 for an order UNNA does not know', async () => {
    syncByMpOrderId.mockResolvedValue(null);

    expect((await post({ 'x-signature': signature(), 'x-request-id': REQUEST_ID })).status).toBe(200);
  });

  it('answers 503 when the sync of a known order fails, so Mercado Pago retries the notification', async () => {
    syncByMpOrderId.mockRejectedValue(new Error('Mercado Pago respondió 500'));

    const response = await post({ 'x-signature': signature(), 'x-request-id': REQUEST_ID });

    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('Mercado Pago respondió 500');
  });

  it.each([
    ['missing', {}],
    ['missing request id', { 'x-signature': signature() }],
    ['invalid', { 'x-signature': 'ts=1,v1=abc', 'x-request-id': REQUEST_ID }],
    ['tampered', { 'x-signature': signature().replace(/v1=./, 'v1=x'), 'x-request-id': REQUEST_ID }],
    ['for another order', { 'x-signature': signature('ORD-OTHER'), 'x-request-id': REQUEST_ID }],
  ])('answers 401 to a %s signature without touching any data', async (_case, headers) => {
    const response = await post(headers as Record<string, string>);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Firma de Mercado Pago inválida');
    expect(syncByMpOrderId).not.toHaveBeenCalled();
  });

  it('answers 401 to everything while MP_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.MP_WEBHOOK_SECRET;

    expect((await post({ 'x-signature': signature(), 'x-request-id': REQUEST_ID })).status).toBe(401);
    expect(syncByMpOrderId).not.toHaveBeenCalled();
  });

  it('answers 200 without syncing when a validly signed notification has no data.id', async () => {
    const manifest = `request-id:${REQUEST_ID};ts:${TS};`;
    const headers = { 'x-signature': `ts=${TS},v1=${createHmac('sha256', SECRET).update(manifest).digest('hex')}`, 'x-request-id': REQUEST_ID };

    const response = await request(app.getHttpServer()).post('/public/mercadopago/webhook?type=order').set(headers).send({});

    expect(response.status).toBe(200);
    expect(syncByMpOrderId).not.toHaveBeenCalled();
  });
});
