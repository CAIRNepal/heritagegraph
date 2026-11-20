import { apiFetchJson } from '@/lib/api-client';
import { getPublicApiUrl } from '@/lib/api-base';

/** Mirrors `heritage_data/contributor_terms.py` (GET/POST /data/api/contributor-consent/). */
export interface ContributorConsent {
  terms_version: string;
  terms: string[];
  accepted: boolean;
  accepted_version: string | null;
  accepted_at: string | null;
  show_on_leaderboard: boolean;
}

const url = () => `${getPublicApiUrl()}/data/api/contributor-consent/`;

function headers(token?: string): HeadersInit {
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function fetchContributorConsent(token?: string): Promise<ContributorConsent> {
  return apiFetchJson<ContributorConsent>(url(), { headers: headers(token) });
}

export function updateContributorConsent(
  token: string | undefined,
  body: { accept?: true; show_on_leaderboard?: boolean },
): Promise<ContributorConsent> {
  return apiFetchJson<ContributorConsent>(url(), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
}
