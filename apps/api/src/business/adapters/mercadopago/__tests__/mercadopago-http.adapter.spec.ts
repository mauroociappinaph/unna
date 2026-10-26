import { MercadoPagoHttpAdapter, toMercadoPagoAmount, fromMercadoPagoAmount } from '../mercadopago-http.adapter';

const CONFIG = { clientId: '123', clientSecret: 'app-secret', redirectUri: 'https://api.example.com/api/v1/mercadopago/oauth/callback' };
const SELLER_TOKEN = 'APP_USR-seller-access-token';

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;

const setup = (status: number, body: unknown) => {
  const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit]>(async () => reply(status, body));
  return { fetchImpl, adapter: new MercadoPagoHttpAdapter(CONFIG, fetchImpl as unknown as typeof fetch) };
};
const call = (fetchImpl: jest.Mock, index = 0) => {
  const [url, init] = fetchImpl.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string>, body: init.body ? JSON.parse(init.body as string) : undefined };
};

const TOKEN_RESPONSE = {
  access_token: 'APP_USR-new-access', token_type: 'Bearer', expires_in: 15552000, scope: 'offline_access read write',
  user_id: 987654321, refresh_token: 'TG-new-refresh', public_key: 'APP_USR-pk', live_mode: true,
};

describe('MercadoPagoHttpAdapter (S15)', () => {
  it('builds the authorization URL with state, redirect URI and the S256 PKCE challenge', () => {
    const { adapter } = setup(200, {});
    const url = new URL(adapter.buildAuthorizationUrl({ state: 'S'.repeat(43), codeChallenge: 'challenge' }));
    expect(`${url.origin}${url.pathname}`).toBe('https://auth.mercadopago.com/authorization');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: '123', response_type: 'code', platform_id: 'mp', state: 'S'.repeat(43),
      redirect_uri: CONFIG.redirectUri, code_challenge: 'challenge', code_challenge_method: 'S256',
    });
  });

  it('exchanges the code with the PKCE verifier and maps the tokens', async () => {
    const { adapter, fetchImpl } = setup(200, TOKEN_RESPONSE);
    const tokens = await adapter.exchangeCode({ code: 'TG-code', codeVerifier: 'v'.repeat(43) });
    const { url, init, body } = call(fetchImpl);
    expect(url).toBe('https://api.mercadopago.com/oauth/token');
    expect(init.method).toBe('POST');
    expect(body).toEqual({
      client_id: '123', client_secret: 'app-secret', grant_type: 'authorization_code', code: 'TG-code',
      redirect_uri: CONFIG.redirectUri, code_verifier: 'v'.repeat(43),
    });
    expect(tokens).toEqual({
      accessToken: 'APP_USR-new-access', refreshToken: 'TG-new-refresh', expiresInSeconds: 15552000,
      scope: 'offline_access read write', mpUserId: '987654321', liveMode: true,
    });
  });

  it('refreshes with the refresh_token grant', async () => {
    const { adapter, fetchImpl } = setup(200, TOKEN_RESPONSE);
    await adapter.refreshToken('TG-old-refresh');
    expect(call(fetchImpl).body).toEqual({ client_id: '123', client_secret: 'app-secret', grant_type: 'refresh_token', refresh_token: 'TG-old-refresh' });
  });

  it('creates the store with the seller token and location', async () => {
    const { adapter, fetchImpl } = setup(201, { id: 1234567 });
    const store = await adapter.createStore(SELLER_TOKEN, {
      mpUserId: '987654321', name: 'Palermo', externalId: 'UNNASabc',
      location: { streetName: 'Honduras', streetNumber: '5000', cityName: 'CABA', stateName: 'Buenos Aires', reference: 'Palermo' },
    });
    const { url, headers, body } = call(fetchImpl);
    expect(url).toBe('https://api.mercadopago.com/users/987654321/stores');
    expect(headers.Authorization).toBe(`Bearer ${SELLER_TOKEN}`);
    expect(body).toEqual({
      name: 'Palermo', external_id: 'UNNASabc',
      location: { street_name: 'Honduras', street_number: '5000', city_name: 'CABA', state_name: 'Buenos Aires', reference: 'Palermo' },
    });
    expect(store).toEqual({ id: '1234567' });
  });

  it('creates the POS with X-Idempotency-Key and returns its static QR', async () => {
    const { adapter, fetchImpl } = setup(201, {
      id: 555, external_id: 'UNNAPabc',
      qr: { image: 'https://mp/qr.png', template_document: 'https://mp/qr.pdf' },
      qr_response: { image: 'https://mp/qr.png', template_document: 'https://mp/qr.pdf' },
    });
    const pos = await adapter.createPos(SELLER_TOKEN, { name: 'Palermo', storeId: '1234567', externalId: 'UNNAPabc', idempotencyKey: 'key-1' });
    const { url, headers, body } = call(fetchImpl);
    expect(url).toBe('https://api.mercadopago.com/v2/pos');
    expect(headers['X-Idempotency-Key']).toBe('key-1');
    expect(body).toEqual({ name: 'Palermo', store_id: 1234567, external_id: 'UNNAPabc', config: { qr: { operating_mode: 'pdv' } } });
    expect(pos).toEqual({ id: '555', externalId: 'UNNAPabc', qrImageUrl: 'https://mp/qr.png', qrTemplateUrl: 'https://mp/qr.pdf' });
  });

  it('creates a hybrid QR order with X-Idempotency-Key and decimal amounts', async () => {
    const { adapter, fetchImpl } = setup(201, {
      id: 'ORD01', status: 'created', status_detail: 'created', external_reference: 'unna-o1', total_amount: '50.00',
      transactions: { payments: [{ id: 'PAY01', amount: '50.00' }] }, type_response: { qr_data: '000201...' },
    });
    const order = await adapter.createQrOrder(SELLER_TOKEN, {
      externalReference: 'unna-o1', externalPosId: 'UNNAPabc', amount: 5000, description: 'Pedido 12', expirationTime: 'PT15M', idempotencyKey: 'key-2',
    });
    const { url, headers, body } = call(fetchImpl);
    expect(url).toBe('https://api.mercadopago.com/v1/orders');
    expect(headers['X-Idempotency-Key']).toBe('key-2');
    expect(body).toEqual({
      type: 'qr', external_reference: 'unna-o1', total_amount: '50.00', description: 'Pedido 12', expiration_time: 'PT15M',
      config: { qr: { external_pos_id: 'UNNAPabc', mode: 'hybrid' } }, transactions: { payments: [{ amount: '50.00' }] },
    });
    expect(order).toEqual({
      id: 'ORD01', status: 'created', statusDetail: 'created', externalReference: 'unna-o1', totalAmount: 5000, paymentId: 'PAY01', qrData: '000201...',
    });
  });

  it('reads and cancels orders (cancel with X-Idempotency-Key)', async () => {
    const { adapter, fetchImpl } = setup(200, { id: 'ORD01', status: 'canceled', total_amount: '50.00' });
    expect((await adapter.getOrder(SELLER_TOKEN, 'ORD01')).status).toBe('canceled');
    expect(call(fetchImpl, 0).url).toBe('https://api.mercadopago.com/v1/orders/ORD01');
    expect(call(fetchImpl, 0).init.method).toBe('GET');
    await adapter.cancelOrder(SELLER_TOKEN, 'ORD01', 'key-3');
    expect(call(fetchImpl, 1).url).toBe('https://api.mercadopago.com/v1/orders/ORD01/cancel');
    expect(call(fetchImpl, 1).headers['X-Idempotency-Key']).toBe('key-3');
  });

  it('reports errors by status and code only: no token, secret or response text', async () => {
    const { adapter } = setup(400, { error: 'invalid_grant', message: `bad ${SELLER_TOKEN} app-secret` });
    const failure = adapter.refreshToken('TG-old-refresh');
    await expect(failure).rejects.toThrow('Mercado Pago respondió 400 (invalid_grant)');
    const message = await failure.catch((e: Error) => e.message);
    for (const secret of [SELLER_TOKEN, 'app-secret', 'TG-old-refresh']) expect(message).not.toContain(secret);
  });

  it('reports network failures without details', async () => {
    const fetchImpl = jest.fn(async () => { throw new Error(`connect ECONNREFUSED ${SELLER_TOKEN}`); });
    const adapter = new MercadoPagoHttpAdapter(CONFIG, fetchImpl as unknown as typeof fetch);
    await expect(adapter.getOrder(SELLER_TOKEN, 'ORD01')).rejects.toThrow(/^No se pudo conectar con Mercado Pago$/);
  });

  it('converts cents to and from decimal strings', () => {
    expect(toMercadoPagoAmount(5000)).toBe('50.00');
    expect(toMercadoPagoAmount(12345)).toBe('123.45');
    expect(toMercadoPagoAmount(5)).toBe('0.05');
    expect(fromMercadoPagoAmount('123.45')).toBe(12345);
    expect(fromMercadoPagoAmount('0.1')).toBe(10);
    expect(fromMercadoPagoAmount(undefined)).toBe(0);
  });
});
