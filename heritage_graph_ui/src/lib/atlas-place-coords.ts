import type { AtlasCoordProvenance } from '@/types/atlas';

/**
 * WGS84 coordinates for well-known heritage places when API rows lack point fields.
 * Mirrors `museum_graph_enrichment._KNOWN_PLACE_COORDS` plus valley settlements.
 */
export const KNOWN_PLACE_COORDS: Record<string, { lat: number; lon: number }> = {
  'kathmandu durbar square': { lat: 27.7042, lon: 85.3076 },
  'patan durbar square': { lat: 27.6729, lon: 85.3265 },
  'bhaktapur durbar square': { lat: 27.6721, lon: 85.4298 },
  pashupatinath: { lat: 27.7104, lon: 85.3486 },
  'pashupatinath temple': { lat: 27.7104, lon: 85.3486 },
  boudhanath: { lat: 27.7215, lon: 85.362 },
  'boudhanath stupa': { lat: 27.7215, lon: 85.362 },
  swayambhunath: { lat: 27.7149, lon: 85.2903 },
  'changu narayan': { lat: 27.7164, lon: 85.4277 },
  'changu narayan temple': { lat: 27.7164, lon: 85.4277 },
  'hanuman dhoka': { lat: 27.7047, lon: 85.3073 },
  'kathmandu valley': { lat: 27.7172, lon: 85.324 },
  basantapur: { lat: 27.7047, lon: 85.3073 },
  'basantapur tower': { lat: 27.7047, lon: 85.3073 },
  'taleju temple precinct': { lat: 27.7045, lon: 85.3078 },
  lumbini: { lat: 27.4833, lon: 83.2756 },
  sankhu: { lat: 27.7167, lon: 85.5167 },
  thimi: { lat: 27.68, lon: 85.3833 },
  kirtipur: { lat: 27.6717, lon: 85.2783 },
  'nuwakot durbar': { lat: 27.9167, lon: 85.1667 },
  patan: { lat: 27.6766, lon: 85.325 },
  bhaktapur: { lat: 27.671, lon: 85.4298 },
  kathmandu: { lat: 27.7172, lon: 85.324 },
  pokhara: { lat: 28.2096, lon: 83.9856 },
  janakpur: { lat: 26.7288, lon: 85.9266 },
  gorkha: { lat: 28.0, lon: 84.6333 },
  mustang: { lat: 28.9985, lon: 83.8473 },
};

const POINT_RE = /POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i;

export interface ResolvedCoords {
  lat?: number;
  lon?: number;
  provenance: AtlasCoordProvenance;
}

export function normalizePlaceKey(label: string | null | undefined): string {
  return (label ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseLatLngPair(a: string, b: string): { lat: number; lon: number } | undefined {
  const lat = Number(a);
  const lon = Number(b);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return { lat, lon };
}

/** Parse coordinates from API raw row fields (point, coordinates_legacy, place_coordinates). */
export function coordsFromRawFields(raw: Record<string, unknown>): ResolvedCoords {
  const lat = raw.latitude;
  const lon = raw.longitude;
  if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return { lat, lon, provenance: 'verified' };
    }
  }

  for (const key of ['point', 'coordinates_legacy', 'place_coordinates'] as const) {
    const v = raw[key];
    if (v == null) continue;
    const text = String(v).trim();
    if (!text) continue;

    const wkt = POINT_RE.exec(text);
    if (wkt) {
      const hit = parseLatLngPair(wkt[2], wkt[1]);
      if (hit) return { ...hit, provenance: 'verified' };
    }

    const parts = text.replace(/[()]/g, '').split(/[,\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      const hit = parseLatLngPair(parts[0], parts[1]);
      if (hit) return { ...hit, provenance: 'verified' };
    }
  }

  return { provenance: 'unmapped' };
}

/** Resolve coordinates from entity label using the known-place gazetteer. */
export function coordsFromKnownPlace(label: string | null | undefined): ResolvedCoords {
  const key = normalizePlaceKey(label);
  if (!key) return { provenance: 'unmapped' };

  const exact = KNOWN_PLACE_COORDS[key];
  if (exact) return { ...exact, provenance: 'gazetteer' };

  for (const [known, coords] of Object.entries(KNOWN_PLACE_COORDS)) {
    if (key.includes(known) || known.includes(key)) {
      return { ...coords, provenance: 'gazetteer' };
    }
  }

  return { provenance: 'unmapped' };
}

/**
 * Tiered resolution: verified form/API coords → gazetteer name match → unmapped.
 * Unmapped places remain in the catalog (Search) but are excluded from the globe.
 */
export function resolveCoordsWithProvenance(
  raw: Record<string, unknown>,
  label: string,
): ResolvedCoords {
  const fromFields = coordsFromRawFields(raw);
  if (fromFields.lat != null && fromFields.lon != null) return fromFields;
  return coordsFromKnownPlace(label);
}
