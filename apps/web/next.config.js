import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@repo/i18n',
    '@repo/shared-types',
    '@repo/ui',
    '@repo/validation',
  ],
};

export default withNextIntl(nextConfig);
