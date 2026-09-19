/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/shared-types', '@repo/ui', '@repo/validation'],
};

export default nextConfig;
