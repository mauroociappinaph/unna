import { CreateMercadoPagoOnlineOrderRequest } from '@unna/domain';
import { MercadoPagoHttpAdapter } from '../mercadopago-http.adapter';
import { MercadoPagoSimulatorAdapter } from '../mercadopago-simulator.adapter';

const CONFIG = { clientId: '123', clientSecret: 'app-secret', redirectUri: 'https://api.example.com/api/v1/mercadopago/oauth/callback' };
const SELLER_TOKEN = 'APP_USR-seller-access-token';
const TRACKING = 'https://unna.example.com/pedido/seguimiento/TOKEN';

const REQUEST: CreateMercadoPagoOnlineOrderRequest = {
  externalReference: 'UNNAPAabc',
  amount: 302500,
  items: [{ title: 'Café con leche', quantity: 2, unitPrice: 121000 }, { title: '1 × Medialuna', quantity: 1, unitPrice: 60500 }],
  expirationTime: 'PT15M',
  successUrl: TRACKING,
  failureUrl: TRACKING,
  pendingUrl: TRACKING,
  idempotencyKey: 'key-1',
};

const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

describe('Mercado Pago online orders (S20)', () => {
  describe('MercadoPagoHttpAdapter.createOnlineOrder', () => {
    const setup = (status: number, body: unknown) => {
      const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit]>(async () => reply(status, body));
      return { fetchImpl, adapter: new MercadoPagoHttpAdapter(CONFIG, fetchImpl as unknown as typeof fetch) };
    };

    it('creates a Checkout Pro order through the Orders API with X-Idempotency-Key and decimal amounts', async () => {
      const { adapter, fetchImpl } = setup(201, { id: 'ORD01ONLINE', status: 'created', checkout_url: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1' });

      const order = await adapter.createOnlineOrder(SELLER_TOKEN, REQUEST);

      const [url, init] = fetchImpl.mock.calls[0];
      const headers = init.headers as Record<string, string>;
      expect(url).toBe('https://api.mercadopago.com/v1/orders');
      expect(init.method).toBe('POST');
      expect(headers.Authorization).toBe(`Bearer ${SELLER_TOKEN}`);
      expect(headers['X-Idempotency-Key']).toBe('key-1');
      expect(JSON.parse(init.body as string)).toEqual({
        type: 'online',
        processing_mode: 'manual',
        external_reference: 'UNNAPAabc',
        total_amount: '3025.00',
        expiration_time: 'PT15M',
        items: [
          { title: 'Café con leche', quantity: 2, unit_price: '1210.00' },
          { title: '1 × Medialuna', quantity: 1, unit_price: '605.00' },
        ],
        config: { online: { success_url: TRACKING, failure_url: TRACKING, pending_url: TRACKING, auto_return: 'approved' } },
      });
      expect(order).toEqual({ id: 'ORD01ONLINE', status: 'created', checkoutUrl: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1' });
    });

    it('fails when Mercado Pago returns no checkout URL', async () => {
      const { adapter } = setup(201, { id: 'ORD01ONLINE', status: 'created' });

      await expect(adapter.createOnlineOrder(SELLER_TOKEN, REQUEST)).rejects.toThrow('Mercado Pago no devolvió el link de pago');
    });

    it.each(['failed', 'processing'])('reads the %s status of an order', async (status) => {
      const { adapter } = setup(200, { id: 'ORD01ONLINE', status, total_amount: '3025.00' });

      expect((await adapter.getOrder(SELLER_TOKEN, 'ORD01ONLINE')).status).toBe(status);
    });
  });

  describe('MercadoPagoSimulatorAdapter.createOnlineOrder', () => {
    it('points the checkout URL to the API simulator route and keeps the success URL', async () => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost:3001/api/v1/mercadopago/oauth/callback');

      const order = await simulator.createOnlineOrder('', REQUEST);

      expect(order.status).toBe('created');
      expect(order.checkoutUrl).toBe(`http://localhost:3001/api/v1/mercadopago/simulator/checkout/${order.id}`);
      expect(simulator.successUrlOf(order.id)).toBe(TRACKING);
      expect((await simulator.getOrder('', order.id)).totalAmount).toBe(302500);
    });

    it('answers a retried request (same idempotency key) with the same order', async () => {
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost:3001/cb');

      const first = await simulator.createOnlineOrder('', REQUEST);
      const again = await simulator.createOnlineOrder('', REQUEST);

      expect(again.id).toBe(first.id);
    });

    it('pays it with markPaid and expires it after the expiration time', async () => {
      let now = new Date('2026-10-26T12:00:00Z');
      const simulator = new MercadoPagoSimulatorAdapter('http://localhost:3001/cb', () => now);
      const paid = await simulator.createOnlineOrder('', REQUEST);
      const unpaid = await simulator.createOnlineOrder('', { ...REQUEST, idempotencyKey: 'key-2' });

      expect(simulator.markPaid(paid.id)).toBe(true);
      now = new Date('2026-10-26T12:16:00Z');

      expect((await simulator.getOrder('', paid.id)).status).toBe('processed');
      expect((await simulator.getOrder('', unpaid.id)).status).toBe('expired');
      expect(simulator.successUrlOf('ORD-UNKNOWN')).toBeNull();
    });
  });
});
