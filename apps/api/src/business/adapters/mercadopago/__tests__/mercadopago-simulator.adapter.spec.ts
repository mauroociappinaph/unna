import { MercadoPagoSimulatorAdapter } from '../mercadopago-simulator.adapter';

const CALLBACK = 'http://localhost:3001/api/v1/mercadopago/oauth/callback';

describe('MercadoPagoSimulatorAdapter (S15, never in production)', () => {
  it('authorizes instantly: the URL goes straight to the API callback with a fake code and the state', () => {
    const url = new URL(new MercadoPagoSimulatorAdapter(CALLBACK).buildAuthorizationUrl({ state: 'S'.repeat(43), codeChallenge: 'c' }));
    expect(`${url.origin}${url.pathname}`).toBe(CALLBACK);
    expect(url.searchParams.get('state')).toBe('S'.repeat(43));
    expect(url.searchParams.get('code')).toMatch(/^SIM-/);
  });

  it('exchanges any code for fresh test tokens (180 days, test mode)', async () => {
    const simulator = new MercadoPagoSimulatorAdapter(CALLBACK);
    const tokens = await simulator.exchangeCode({ code: 'SIM-1', codeVerifier: 'v'.repeat(43) });
    expect(tokens).toMatchObject({ expiresInSeconds: 15552000, liveMode: false, scope: 'offline_access read write' });
    const refreshed = await simulator.refreshToken(tokens.refreshToken);
    expect(refreshed.refreshToken).not.toBe(tokens.refreshToken);
    expect(refreshed.mpUserId).toBe(tokens.mpUserId);
    await expect(simulator.exchangeCode({ code: 'TG-real-code', codeVerifier: 'v' })).rejects.toThrow('Mercado Pago respondió 400 (invalid_grant)');
  });

  it('creates a fake store and POS with placeholder QR URLs', async () => {
    const simulator = new MercadoPagoSimulatorAdapter(CALLBACK);
    const store = await simulator.createStore('t', { mpUserId: '1', name: 'Palermo', externalId: 'UNNASabc', location: { streetName: 'a', streetNumber: '1', cityName: 'c', stateName: 's' } });
    const pos = await simulator.createPos('t', { name: 'Palermo', storeId: store.id, externalId: 'UNNAPabc', idempotencyKey: 'k' });
    expect(pos.externalId).toBe('UNNAPabc');
    expect(pos.qrImageUrl).toMatch(/^https:\/\/.+\.png$/);
    expect(pos.qrTemplateUrl).toMatch(/^https:\/\/.+\.pdf$/);
  });

  it('keeps QR orders in memory: created with qr_data, then paid on demand or cancelled while unpaid', async () => {
    const simulator = new MercadoPagoSimulatorAdapter(CALLBACK);
    const order = await simulator.createQrOrder('t', { externalReference: 'r', externalPosId: 'UNNAPabc', amount: 5000, description: 'd', expirationTime: 'PT15M', idempotencyKey: 'k1' });
    expect(order).toMatchObject({ status: 'created', totalAmount: 5000, externalReference: 'r' });
    expect(order.qrData).toBeTruthy();
    expect((await simulator.createQrOrder('t', { externalReference: 'r', externalPosId: 'UNNAPabc', amount: 5000, description: 'd', expirationTime: 'PT15M', idempotencyKey: 'k1' })).id).toBe(order.id);

    expect(simulator.markPaid(order.id)).toBe(true);
    const paid = await simulator.getOrder('t', order.id);
    expect(paid.status).toBe('processed');
    expect(paid.paymentId).toMatch(/^PAY/);
    await expect(simulator.cancelOrder('t', order.id, 'k2')).rejects.toThrow('Mercado Pago respondió 409 (order_already_processed)');

    const other = await simulator.createQrOrder('t', { externalReference: 'r2', externalPosId: 'UNNAPabc', amount: 100, description: 'd', expirationTime: 'PT15M', idempotencyKey: 'k3' });
    expect((await simulator.cancelOrder('t', other.id, 'k4')).status).toBe('canceled');
    expect((await simulator.cancelOrder('t', other.id, 'k4')).status).toBe('canceled');
    await expect(simulator.cancelOrder('t', other.id, 'k5')).rejects.toThrow('Mercado Pago respondió 409 (order_already_canceled)');
    expect(simulator.markPaid(other.id)).toBe(false);
    expect(simulator.markPaid('ORD-unknown')).toBe(false);
    await expect(simulator.getOrder('t', 'ORD-unknown')).rejects.toThrow('Mercado Pago respondió 404 (order_not_found)');
  });

  it('expires unpaid orders after their expiration time', async () => {
    let now = new Date('2026-10-25T12:00:00Z');
    const simulator = new MercadoPagoSimulatorAdapter(CALLBACK, () => now);
    const order = await simulator.createQrOrder('t', { externalReference: 'r', externalPosId: 'p', amount: 100, description: 'd', expirationTime: 'PT15M', idempotencyKey: 'k' });
    now = new Date('2026-10-25T12:15:01Z');
    expect((await simulator.getOrder('t', order.id)).status).toBe('expired');
    expect(simulator.markPaid(order.id)).toBe(false);
  });
});
