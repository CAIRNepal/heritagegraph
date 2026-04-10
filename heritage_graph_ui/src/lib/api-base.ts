/**
 * Public API origin for browser-side fetches.
 * Configure `NEXT_PUBLIC_API_URL` (see `heritage_graph_ui/.env.example`).
 *
 * In production builds, avoid silently falling back to localhost — that creates
 * confusing failures and undermines trust. Development still defaults to
 * `http://localhost:8000` when unset for local ergonomics.
 */
export function getPublicApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) {
    return raw.replace(/\/+$/, '');
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8000';
  }
  return '';
}

/** True when `NEXT_PUBLIC_API_URL` is set (recommended for all deployed envs). */
export function isPublicApiUrlConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());
}
