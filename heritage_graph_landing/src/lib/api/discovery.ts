import { getApiBaseUrl } from '@/lib/config';
import { apiFetch, getApiErrorMessage } from '@/lib/api-fetch';
import type { DiscoveryCategory } from '@/data/dummyDiscovery';

export interface DiscoveryResult {
  id: string;
  resource: string;
  type: string;
  name: string;
  summary: string;
  location_hint: string;
  cultural_entity_id: string | null;
  status?: string;
  is_published?: boolean;
  has_media?: boolean;
}

export interface DiscoveryResponse {
  q: string;
  type: string;
  counts: Record<string, number>;
  results: DiscoveryResult[];
}

export async function fetchPublicDiscovery(
  category: DiscoveryCategory,
  q: string,
  options?: { signal?: AbortSignal }
): Promise<DiscoveryResponse> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams({ type: category });
  const trimmed = q.trim();
  if (trimmed) {
    params.set('q', trimmed);
  }
  const url = `${base}/cidoc/discovery/?${params.toString()}`;
  try {
    const res = await apiFetch(url, {
      signal: options?.signal,
      headers: { Accept: 'application/json' },
    });
    return res.json() as Promise<DiscoveryResponse>;
  } catch (e) {
    throw new Error(getApiErrorMessage(e, 'Discovery could not load results. Please try again.'));
  }
}
