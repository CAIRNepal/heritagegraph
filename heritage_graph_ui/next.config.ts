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
