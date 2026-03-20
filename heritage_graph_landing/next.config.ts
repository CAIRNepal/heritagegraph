import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Keep tracing inside this app (repo root has another lockfile)
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
