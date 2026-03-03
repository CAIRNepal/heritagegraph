import type { NextConfig } from 'next';
import path from 'path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    domains: ['i.imgur.com'], // Add your image domains here
  },
  eslint: {
    ignoreDuringBuilds: true, // disables ESLint errors breaking production build
  },
  typescript: {
    ignoreBuildErrors: true, // allow build even if there are TS errors
  },
};

export default withNextIntl(nextConfig);
