/**
 * Public API origin for browser-side fetches.
 * Configure `NEXT_PUBLIC_API_URL` (see `heritage_graph_ui/.env.example`).
 */
export function getPublicApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
}
