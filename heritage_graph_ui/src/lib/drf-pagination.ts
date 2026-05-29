/**
 * Helpers for Django REST Framework LimitOffsetPagination (project default).
 */

export function limitOffsetSearchParams(
  page: number,
  pageSize: number,
  extra?: Record<string, string | number | boolean | undefined | null>,
): URLSearchParams {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const sp = new URLSearchParams();
  sp.set("limit", String(safeSize));
  sp.set("offset", String((safePage - 1) * safeSize));
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined || value === null || value === "") continue;
      sp.set(key, String(value));
    }
  }
  return sp;
}

export function totalPages(count: number, pageSize: number): number {
  if (count <= 0) return 1;
  return Math.max(1, Math.ceil(count / Math.max(1, pageSize)));
}

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
