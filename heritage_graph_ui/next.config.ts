import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ['i.imgur.com'], // Add your image domains here
  },
  eslint: {
    ignoreDuringBuilds: true, // disables ESLint errors breaking production build
  },
  validity: {
    ignoreDuringBuilds: true, // disables ESLint errors breaking production build
  },

};

export default nextConfig;
