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

/**
 * Origin for server-side fetches (NextAuth callbacks, RSC).
 * Resolution order: INTERNAL_BACKEND_URL → NEXT_PUBLIC_API_URL → dev localhost → Docker service name.
 */
export function getInternalBackendUrl(): string {
  const internal = process.env.INTERNAL_BACKEND_URL?.trim();
  if (internal) {
    return internal.replace(/\/+$/, "");
  }
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) {
    return pub.replace(/\/+$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:8000";
  }
  return "http://backend:8000";
}
