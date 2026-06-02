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

// Esri ArcGIS tile hosts back the Atlas globe (Cesium). Cesium fetches tiles via
// XHR/createImageBitmap, so the host must be allowed in BOTH connect-src (the
// fetch) and img-src (the <img> fallback) — otherwise the CSP silently blocks
// every tile and the globe renders as a bare blue sphere with no Earth imagery.
//
// Note: ArcGIS endpoints may redirect between subdomains (e.g. server → services),
// so we allow the common hostnames plus the wildcard.
const MAP_TILE_HOSTS = [
  'https://server.arcgisonline.com',
  'https://services.arcgisonline.com',
  'https://*.arcgisonline.com',
];

function buildContentSecurityPolicy(): string {
  const connectSrc = ["'self'", 'https://accounts.google.com', 'https://oauth2.googleapis.com'];
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (apiUrl) {
    try {
      connectSrc.push(new URL(apiUrl).origin);
    } catch {
      /* ignore invalid URL at build time */
    }
  }
  connectSrc.push(...MAP_TILE_HOSTS);

  return [
    "default-src 'self'",
    `connect-src ${connectSrc.join(' ')}`,
    "form-action 'self' https://accounts.google.com",
    "frame-src https://accounts.google.com",
    // Cesium uses web workers (often from blob: URLs). Without this, some
    // browsers will block worker startup under default-src 'self', and the globe
    // can render without imagery/terrain updates.
    "worker-src 'self' blob:",
    // Wikimedia hosts power the heritage-museum demo corpus (Special:FilePath on
    // *.wikipedia.org redirects to upload.wikimedia.org); they feed both the <img>
    // heroes/thumbnails and the WebGL panorama texture in the XR view.
    // arcgisonline serves the Atlas globe satellite/reference tiles.
    `img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.googleusercontent.com https://i.imgur.com https://*.wikipedia.org https://*.wikimedia.org ${MAP_TILE_HOSTS.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "font-src 'self' data:",
  ].join('; ');
}

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  transpilePackages: ['cesium', 'resium'],
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

  /**
   * Legacy URLs: the app previously exposed some routes under `/dashboard`.
   * Authenticated UI now lives at the site root (e.g. `/` not `/dashboard`).
   */
  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/dashboard/', destination: '/', permanent: true },
      { source: '/dashboard/:path*', destination: '/:path*', permanent: true },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy(),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
