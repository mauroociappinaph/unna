import type { ThrottlerOptions } from '@nestjs/throttler';

export const PUBLIC_BOARD_THROTTLER = 'public-board';
export const PUBLIC_ORDER_THROTTLER = 'public-order';
export const PUBLIC_ORDER_CHECKOUT_THROTTLER = 'public-order-checkout';

const DEFAULT_LIMIT = 120;
const DEFAULT_CHECKOUT_LIMIT = 30;
/** Reads (menu, tracking) per minute for each allowed checkout creation. */
const READS_PER_CHECKOUT = 4;
const MINUTE_MS = 60_000;

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const configured = Number(value);
  return Number.isInteger(configured) && configured > 0 ? configured : fallback;
};

/**
 * Rate limit for the public order board, per client IP. A screen polls every 5 s (12 requests a
 * minute), so the default leaves room for about 10 screens behind the same router. Behind a proxy
 * set TRUST_PROXY so the limit applies to the real client IP and not to the proxy.
 */
export function publicBoardThrottlerOptions(env: NodeJS.ProcessEnv = process.env): ThrottlerOptions[] {
  return [{ name: PUBLIC_BOARD_THROTTLER, ttl: MINUTE_MS, limit: positiveInteger(env.PUBLIC_BOARD_RATE_LIMIT, DEFAULT_LIMIT) }];
}

/**
 * Rate limits of the public pedido anticipado routes (S20), per client IP and route:
 * PUBLIC_ORDER_RATE_LIMIT checkout creations a minute (default 30) and four times as many reads of
 * the menu and the tracking page (default 120; a tracking page polls every few seconds).
 */
export function publicOrderThrottlerOptions(env: NodeJS.ProcessEnv = process.env): ThrottlerOptions[] {
  const checkouts = positiveInteger(env.PUBLIC_ORDER_RATE_LIMIT, DEFAULT_CHECKOUT_LIMIT);
  return [
    { name: PUBLIC_ORDER_THROTTLER, ttl: MINUTE_MS, limit: checkouts * READS_PER_CHECKOUT },
    { name: PUBLIC_ORDER_CHECKOUT_THROTTLER, ttl: MINUTE_MS, limit: checkouts },
  ];
}

/**
 * Number of proxies in front of the API (TRUST_PROXY), so Express takes the client IP from
 * X-Forwarded-For. Undefined when unset or invalid: then req.ip is the direct peer.
 */
export function trustProxyHops(env: NodeJS.ProcessEnv = process.env): number | undefined {
  const hops = Number(env.TRUST_PROXY);
  return Number.isInteger(hops) && hops > 0 ? hops : undefined;
}
