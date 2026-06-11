/**
 * Shared geo helpers for live KG consumers (Heritage Museum + Heritage Atlas).
 *
 * Mirrors the backend's `museum_graph_enrichment._LOCATION_PRED_RE` so client
 * and server propagate coordinates along the same location predicates.
 */

export const LOCATION_PREDICATE_RE =
  /location|located|place_at|took_place_at|has_current_location|residence|form_of/i;

export interface GeoCoord {
  lat: number;
  lon: number;
}

export interface GeoLink {
  source: string;
  target: string;
  predicate: string;
}

/**
 * Iteratively copy coordinates between endpoints of location-predicate edges
 * until a fixpoint. Mutates `coordById` and returns the ids that inherited
 * coordinates (so callers can label them as `inherited` provenance).
 */
export function propagateCoordsAlongLocationEdges(
  coordById: Map<string, GeoCoord>,
  links: GeoLink[],
): Map<string, GeoCoord> {
  const inherited = new Map<string, GeoCoord>();
  const locationLinks = links.filter((l) => LOCATION_PREDICATE_RE.test(l.predicate));

  let changed = true;
  while (changed) {
    changed = false;
    for (const link of locationLinks) {
      const src = coordById.get(link.source);
      const tgt = coordById.get(link.target);
      if (src && !tgt) {
        coordById.set(link.target, src);
        inherited.set(link.target, src);
        changed = true;
      } else if (tgt && !src) {
        coordById.set(link.source, tgt);
        inherited.set(link.source, tgt);
        changed = true;
      }
    }
  }
  return inherited;
}

export function parseCoord(value: string | number | null | undefined): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}
