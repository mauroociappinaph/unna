import nextConfig from '../../../next.config.js';

// S21: hardening headers on every page; HSTS only in production (local dev runs on plain HTTP).

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

const rulesFor = async (nodeEnv: string): Promise<HeaderRule[]> => {
  const env = process.env as Record<string, string | undefined>;
  const previous = env.NODE_ENV;
  env.NODE_ENV = nodeEnv;
  try {
    return await nextConfig.headers();
  } finally {
    env.NODE_ENV = previous;
  }
};

const asMap = (rule: HeaderRule | undefined) => Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));

const headersFor = async (nodeEnv: string): Promise<Record<string, string>> =>
  asMap((await rulesFor(nodeEnv)).find((rule) => rule.source === '/:path*'));

describe('next.config.js headers (S21)', () => {
  it('sends the hardening headers on every page', async () => {
    expect(await headersFor('development')).toEqual({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
  });

  it('adds HSTS only in production', async () => {
    expect((await headersFor('production'))['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  it.each(['/pantalla/:path*', '/pedido/:path*'])('never sends a referrer from %s (secret token in the URL), declared after the general rule', async (source) => {
    const rules = await rulesFor('production');
    const index = rules.findIndex((rule) => rule.source === source);

    expect(index).toBeGreaterThan(rules.findIndex((rule) => rule.source === '/:path*'));
    expect(asMap(rules[index])).toEqual({ 'Referrer-Policy': 'no-referrer' });
  });

  it('keeps the API rewrite', async () => {
    expect(await nextConfig.rewrites()).toEqual([{ source: '/api/:path*', destination: expect.stringMatching(/\/api\/:path\*$/) }]);
  });
});
