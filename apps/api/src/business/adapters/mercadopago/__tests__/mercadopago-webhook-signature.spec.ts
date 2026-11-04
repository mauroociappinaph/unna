import { createHmac } from 'crypto';
import { mercadoPagoWebhookManifest, verifyMercadoPagoWebhookSignature } from '../mercadopago-webhook-signature';

const SECRET = 'webhook-secret';
const hmac = (manifest: string, secret = SECRET) => createHmac('sha256', secret).update(manifest).digest('hex');
const signed = (manifest: string, ts = '1704908010000', secret = SECRET) => `ts=${ts},v1=${hmac(manifest, secret)}`;
const MANIFEST = 'id:ord01jq4s4ky8hwq6na5pxb65b3d3;request-id:bb56a2f1-6aae-46ac-982e-9dcd3581d08e;ts:1704908010000;';
const valid = { dataId: 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3', requestId: 'bb56a2f1-6aae-46ac-982e-9dcd3581d08e', secret: SECRET };

describe('Mercado Pago webhook signature (S15)', () => {
  it('builds the manifest with the data.id lowercased', () => {
    expect(mercadoPagoWebhookManifest({ dataId: valid.dataId, requestId: valid.requestId, ts: '1704908010000' })).toBe(MANIFEST);
  });

  it('omits the segments that are missing', () => {
    expect(mercadoPagoWebhookManifest({ ts: '1' })).toBe('ts:1;');
    expect(mercadoPagoWebhookManifest({ dataId: 'ORD1', ts: '1' })).toBe('id:ord1;ts:1;');
  });

  it('accepts the HMAC-SHA256 of the manifest, with or without spaces between the parts', () => {
    expect(verifyMercadoPagoWebhookSignature({ ...valid, signature: signed(MANIFEST) })).toBe(true);
    expect(verifyMercadoPagoWebhookSignature({ ...valid, signature: ` ts=1704908010000 , v1=${hmac(MANIFEST)} ` })).toBe(true);
  });

  it('rejects a signature computed over the id without lowercasing it', () => {
    const upper = MANIFEST.replace('ord01jq4s4ky8hwq6na5pxb65b3d3', valid.dataId);
    expect(verifyMercadoPagoWebhookSignature({ ...valid, signature: signed(upper) })).toBe(false);
  });

  it.each([
    ['missing header', undefined],
    ['empty header', ''],
    ['no ts', `v1=${hmac(MANIFEST)}`],
    ['no v1', 'ts=1704908010000'],
    ['v1 not hex', 'ts=1704908010000,v1=zz'],
    ['tampered v1', `ts=1704908010000,v1=${hmac(MANIFEST).replace(/^./, (c) => (c === '0' ? '1' : '0'))}`],
    ['tampered ts', signed(MANIFEST, '1704908010001').replace('ts=1704908010001', 'ts=1704908010002')],
    ['other secret', signed(MANIFEST, '1704908010000', 'other-secret')],
  ])('rejects a %s', (_case, signature) => {
    expect(verifyMercadoPagoWebhookSignature({ ...valid, signature })).toBe(false);
  });

  it('rejects when the signed data.id or request id differ from the request', () => {
    const signature = signed(MANIFEST);
    expect(verifyMercadoPagoWebhookSignature({ ...valid, dataId: 'ORD-OTHER', signature })).toBe(false);
    expect(verifyMercadoPagoWebhookSignature({ ...valid, requestId: 'other', signature })).toBe(false);
  });

  it('rejects everything when the webhook secret is not configured', () => {
    expect(verifyMercadoPagoWebhookSignature({ ...valid, secret: undefined, signature: signed(MANIFEST) })).toBe(false);
    expect(verifyMercadoPagoWebhookSignature({ ...valid, secret: '  ', signature: signed(MANIFEST, '1704908010000', '  ') })).toBe(false);
  });
});
