/**
 * Canonical API URL builders — prefer versioned prefixes; both are mounted on Django,
 * but `/api/v1/...` is the stable contract for new clients (see API_VERSIONING.md).
 */

import { getInternalBackendUrl, getPublicApiUrl } from "@/lib/api-base";

function join(base: string, ...segments: string[]): string {
  const root = base.replace(/\/+$/, "");
  const path = segments
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
  return `${root}/${path}`;
}

/** Browser-facing heritage_data routes (`/api/v1/data/...`). */
export function dataApiPath(...segments: string[]): string {
  return join(getPublicApiUrl(), "api", "v1", "data", ...segments);
}

/** Browser-facing CIDOC routes (`/api/v1/cidoc/...`). */
export function cidocApiPath(...segments: string[]): string {
  return join(getPublicApiUrl(), "api", "v1", "cidoc", ...segments);
}

/**
 * Legacy heritage_data path kept for routes only registered under `/data/api/...`
 * (e.g. review-workspace). Prefer `dataApiPath()` for router resources.
 */
export function legacyDataApiPath(...segments: string[]): string {
  return join(getPublicApiUrl(), "data", "api", ...segments);
}

/** Server-side NextAuth / RSC calls (Docker: `http://backend:8000`). */
export function internalDataApiPath(...segments: string[]): string {
  return join(getInternalBackendUrl(), "data", "api", ...segments);
}

/** Root-level current user roles (`GET /api/user/info`). */
export function apiUserInfoPath(): string {
  return join(getPublicApiUrl(), "api", "user", "info");
}

export function internalApiUserInfoPath(): string {
  return join(getInternalBackendUrl(), "api", "user", "info");
}
