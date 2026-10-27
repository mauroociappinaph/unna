// Hardening headers for every page (S21). HSTS only in production: local dev runs on plain HTTP.
const securityHeaders = () => [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
];

// The screen and the order tracking pages carry a secret token in the URL: never send it as referrer.
// Later rules override the same header of earlier ones.
const noReferrer = [{ key: 'Referrer-Policy', value: 'no-referrer' }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@unna/shared'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders() },
      { source: '/pantalla/:path*', headers: noReferrer },
      { source: '/pedido/:path*', headers: noReferrer },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
