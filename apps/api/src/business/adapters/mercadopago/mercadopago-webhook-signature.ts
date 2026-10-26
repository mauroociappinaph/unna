import { createHmac, timingSafeEqual } from 'crypto';

const HEX_SHA256 = /^[0-9a-f]{64}$/i;

/**
 * Signed manifest of a Mercado Pago notification: `id:<data.id lowercased>;request-id:<x-request-id>;ts:<ts>;`,
 * omitting the segments that are missing.
 */
export function mercadoPagoWebhookManifest({ dataId, requestId, ts }: { dataId?: string; requestId?: string; ts?: string }): string {
  return [
    dataId ? `id:${dataId.toLowerCase()};` : '',
    requestId ? `request-id:${requestId};` : '',
    ts ? `ts:${ts};` : '',
  ].join('');
}

/**
 * Validates `x-signature: ts=<ts>,v1=<hex>` as the HMAC-SHA256 of the manifest with the webhook
 * secret, compared in constant time. False for anything missing or malformed and while the secret is
 * not configured. There is no ts tolerance: a replayed notification only makes UNNA read the order
 * from Mercado Pago again, which is idempotent.
 */
export function verifyMercadoPagoWebhookSignature(params: {
  signature: string | undefined;
  requestId: string | undefined;
  dataId: string | undefined;
  secret: string | undefined;
}): boolean {
  const secret = params.secret?.trim();
  if (!secret || !params.signature) return false;

  const parts = new Map(
    params.signature.split(',').map((part) => {
      const [key, ...value] = part.trim().split('=');
      return [key.trim(), value.join('=').trim()] as const;
    }),
  );
  const ts = parts.get('ts');
  const v1 = parts.get('v1');
  if (!ts || !v1 || !HEX_SHA256.test(v1)) return false;

  const manifest = mercadoPagoWebhookManifest({ dataId: params.dataId, requestId: params.requestId, ts });
  const expected = createHmac('sha256', secret).update(manifest).digest();
  return timingSafeEqual(expected, Buffer.from(v1, 'hex'));
}
