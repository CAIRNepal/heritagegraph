/**
 * UI `type_scope` / entity-type slugs map to CIDOC router segments (spec 007 proposals).
 * Keep in sync with heritage_graph/apps/cidoc_data/urls.py registrations.
 */

export const TYPE_SCOPES = [
  "person",
  "location",
  "event",
  "source",
  "guthi",
  "deity",
  "monument",
  "tradition",
  "historicalperiod",
  "architecturalstructure",
  "ritualevent",
  "festival",
  "castegroup",
] as const;

export type TypeScope = (typeof TYPE_SCOPES)[number];

const TYPE_SCOPE_TO_SEGMENT: Record<TypeScope, string> = {
  person: "persons",
  location: "locations",
  event: "events",
  source: "sources",
  guthi: "guthis",
  deity: "deities",
  monument: "monuments",
  tradition: "traditions",
  historicalperiod: "historical_periods",
  architecturalstructure: "structures",
  ritualevent: "rituals",
  festival: "festivals",
  castegroup: "caste_groups",
};

export function getCidocListSegment(typeScope: string): string | null {
  const seg = TYPE_SCOPE_TO_SEGMENT[typeScope as TypeScope];
  return seg ?? null;
}

/** Normalize DRF limit/offset payloads or bare arrays from list endpoints. */
export function unwrapCidocList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "results" in data) {
    const r = (data as { results: unknown }).results;
    if (Array.isArray(r)) return r as T[];
  }
  return [];
}

export function entityRecordLabel(record: Record<string, unknown>): string {
  const id = record.id;
  const name = record.name ?? record.title ?? record.canonical_label;
  if (typeof name === "string" && name.trim()) return name.trim();
  return `#${String(id)}`;
}
