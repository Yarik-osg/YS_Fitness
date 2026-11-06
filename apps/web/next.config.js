import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createNextIntlPlugin from 'next-intl/plugin';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const postprocessingEntry = path.join(
  realpathSync(path.join(appDir, 'node_modules/@react-three/postprocessing')),
  'dist/index.js',
);

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
    '@react-three/postprocessing',
    'postprocessing',
    'n8ao',
  ],
  // pnpm keeps this package behind a symlink, and Turbopack does not resolve
  // its string-form "exports" field from the app.
  turbopack: {
    resolveAlias: {
      '@react-three/postprocessing': postprocessingEntry,
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-three/postprocessing': postprocessingEntry,
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
