import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
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

export default nextConfig;
