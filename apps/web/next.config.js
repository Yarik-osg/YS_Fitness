import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const apiProxyTarget =
  globalThis.process?.env.API_PROXY_TARGET?.replace(/\/$/, '') ||
  'http://localhost:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Dev-only. Lets a phone open the web app through an ngrok tunnel and still
  // load HMR / internal next-dev assets. Hostnames only, no scheme or port.
  allowedDevOrigins: [
    '*.ngrok-free.app',
    '*.ngrok-free.dev',
    '*.ngrok.app',
    '*.ngrok.io',
  ],
  // One public origin can reach Nest: browser → Next /api/v1 → API_PROXY_TARGET.
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
  transpilePackages: [
    '@repo/i18n',
    '@repo/shared-types',
    '@repo/ui',
    '@repo/validation',
  ],
};

export default withNextIntl(nextConfig);
