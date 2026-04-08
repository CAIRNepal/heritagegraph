import type { NextConfig } from 'next';
import path from 'path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

function apiMediaRemotePattern(): {
  protocol: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname: string;
} | null {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  try {
    const u = new URL(raw);
    return {
      protocol: u.protocol === 'https:' ? 'https' : 'http',
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
      pathname: '/media/**',
    };
  } catch {
    return null;
  }
}

const apiMediaPattern = apiMediaRemotePattern();

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@tabler/icons-react',
      'date-fns',
      'framer-motion',
      'recharts',
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  /**
   * Work around sporadic dev/webpack failures:
   * `TypeError: Cannot read properties of undefined (reading 'createFilename')`
   * from Next's forked `EvalSourceMapDevToolPlugin` when `ModuleFilenameHelpers`
   * is not yet bound on the compiled webpack singleton (e.g. duplicate Next
   * resolution, env quirks). Dropping that plugin in development only disables
   * eval-source-map style maps; production is unchanged.
   */
  webpack: (config, { dev }) => {
    if (!dev || !config.plugins?.length) return config;
    config.plugins = config.plugins.filter((plugin) => {
      const name =
        plugin &&
        typeof plugin === 'object' &&
        'constructor' in plugin &&
        plugin.constructor != null &&
        typeof plugin.constructor === 'function'
          ? plugin.constructor.name
          : '';
      return name !== 'EvalSourceMapDevToolPlugin';
    });
    return config;
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86_400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      ...(apiMediaPattern ? [apiMediaPattern] : []),
    ],
  },
  eslint: {
    ignoreDuringBuilds: true, // disables ESLint errors breaking production build
  },
  typescript: {
    ignoreBuildErrors: true, // allow build even if there are TS errors
  },
};

export default withNextIntl(nextConfig);
