/**
 * Base URL of the main HeritageGraph app (heritage_graph_ui).
 * Set NEXT_PUBLIC_APP_URL in .env.local (see .env.example).
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  return url || 'http://localhost:3000';
}

export function appPath(path: string): string {
  const base = getAppUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Django API origin (no trailing slash). Used by discovery and public record pages.
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
  return url || 'http://localhost:8000';
}
