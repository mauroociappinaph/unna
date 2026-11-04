import type { NextFunction, Request, Response } from 'express';

const ONE_YEAR_SECONDS = 31_536_000;

/**
 * Hardening headers on every API response, without extra dependencies: no MIME sniffing, no
 * framing, no referrer, resources readable only from the same site, and HSTS in production (the
 * API is served over HTTPS there; locally it is plain HTTP).
 */
export function securityHeaders(env: NodeJS.ProcessEnv = process.env) {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-site',
  };
  if (env.NODE_ENV === 'production') headers['Strict-Transport-Security'] = `max-age=${ONE_YEAR_SECONDS}; includeSubDomains`;

  return (_req: Request, res: Response, next: NextFunction): void => {
    res.set(headers);
    next();
  };
}
