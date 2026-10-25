import type { ThrottlerOptions } from '@nestjs/throttler';

const DEFAULT_LIMIT = 120;

/**
 * Rate limit for the public order board, per client IP. A screen polls every 5 s (12 requests a
 * minute), so the default leaves room for about 10 screens behind the same router. Behind a proxy
 * set TRUST_PROXY so the limit applies to the real client IP and not to the proxy.
 */
export function publicBoardThrottlerOptions(env: NodeJS.ProcessEnv = process.env): ThrottlerOptions[] {
  const configured = Number(env.PUBLIC_BOARD_RATE_LIMIT);
  const limit = Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_LIMIT;
  return [{ name: 'public-board', ttl: 60_000, limit }];
}

/**
 * Number of proxies in front of the API (TRUST_PROXY), so Express takes the client IP from
 * X-Forwarded-For. Undefined when unset or invalid: then req.ip is the direct peer.
 */
export function trustProxyHops(env: NodeJS.ProcessEnv = process.env): number | undefined {
  const hops = Number(env.TRUST_PROXY);
  return Number.isInteger(hops) && hops > 0 ? hops : undefined;
}
