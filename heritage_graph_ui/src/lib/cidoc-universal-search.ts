/**
 * Map universal_search group keys → knowledge / contribute domain keys.
 * Keep in sync with cidoc_data.views.universal_search + knowledge routes.
 */
export const UNIVERSAL_SEARCH_DOMAIN_MAP: Readonly<Record<string, string>> = {
  persons: "person",
  locations: "location",
  events: "event",
  traditions: "tradition",
  deities: "deity",
  guthis: "guthi",
  structures: "structure",
  rituals: "ritual",
  festivals: "festival",
  monuments: "monument",
};

/** Knowledge domain → relationship-proposal type_scope (spec 007). */
export const DOMAIN_TO_TYPE_SCOPE: Readonly<Record<string, string>> = {
  person: "person",
  location: "location",
  event: "event",
  tradition: "tradition",
  deity: "deity",
  guthi: "guthi",
  structure: "architecturalstructure",
  ritual: "ritualevent",
  festival: "festival",
  monument: "monument",
  source: "source",
  period: "historicalperiod",
  caste_group: "castegroup",
};

export interface UniversalSearchHit {
  id: string;
  label: string;
  domain: string;
  groupKey: string;
}

export function flattenUniversalSearch(
  data: Record<string, Array<Record<string, unknown>>>
): UniversalSearchHit[] {
  const out: UniversalSearchHit[] = [];
  for (const [groupKey, rows] of Object.entries(data)) {
    const domain = UNIVERSAL_SEARCH_DOMAIN_MAP[groupKey];
    if (!domain || !Array.isArray(rows)) continue;
    for (const r of rows) {
      const id = r.id != null ? String(r.id) : "";
      const label =
        (typeof r.name === "string" && r.name.trim()) ||
        (typeof r.title === "string" && r.title.trim()) ||
        `${domain} #${id}`;
      if (id) out.push({ id, label, domain, groupKey });
    }
  }
  return out;
}

export function contributeEditHref(domain: string, id: string): string {
  return `/contribute/${domain}?id=${encodeURIComponent(id)}`;
}

export function knowledgeViewHref(domain: string, id: string): string {
  return `/knowledge/${domain}/view/${encodeURIComponent(id)}`;
}

export function relationshipFromHref(
  domain: string,
  id: string
): string | null {
  const typeScope = DOMAIN_TO_TYPE_SCOPE[domain];
  if (!typeScope) return null;
  const qs = new URLSearchParams({
    subjectType: typeScope,
    subjectId: id,
  });
  return `/contribute/relationship-proposal?${qs.toString()}`;
}
