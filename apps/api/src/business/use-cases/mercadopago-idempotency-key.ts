import { createHash } from 'crypto';

/** UUID-shaped X-Idempotency-Key derived from `seed`, so a retried request reuses the same key. */
export function stableIdempotencyKey(seed: string): string {
  const hex = createHash('sha256').update(seed).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
