/**
 * Pure logic for the Heritage Atlas: which records are places, their periods,
 * altitudes and distances, and the facts the map states about them. No React,
 * no Leaflet, so it can be unit-tested and reused.
 */

import type { GraphNode } from '@/app/(site)/heritage-museum/heritage-data';
import { parseTemporalAnchor } from '@/lib/heritage-museum/temporal-parse';

/** West, east, south, north. */
export const NEPAL_BOUNDS = { west: 79.8, east: 88.5, south: 26.2, north: 30.6 } as const;
export const VALLEY_BOUNDS = { west: 85.2, east: 85.56, south: 27.58, north: 27.8 } as const;

export interface AtlasPlace {
  node: GraphNode;
  lat: number;
  lon: number;
  year: number | null;
  inValley: boolean;
}

export type EraId = 'early' | 'licchavi' | 'transitional' | 'malla' | 'shah' | 'undated';

/**
 * Periods of Nepal Valley history used to group places. Licchavi, Malla and
 * Shah match the museum timeline (lib/heritage-museum/timeline-layout.ts); the
 * two in between and before make the bands cover every dated year.
 */
export const ERAS: ReadonlyArray<{ id: EraId; from: number | null; to: number | null }> = [
  { id: 'early', from: null, to: 399 },
  { id: 'licchavi', from: 400, to: 879 },
  { id: 'transitional', from: 880, to: 1199 },
  { id: 'malla', from: 1200, to: 1767 },
  { id: 'shah', from: 1768, to: null },
  { id: 'undated', from: null, to: null },
];

const within = (lat: number, lon: number, b: { west: number; east: number; south: number; north: number }) =>
  lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;

/** Records with a usable coordinate inside Nepal. Out-of-range coordinates (one record sits at 88° N) are left out. */
export function placesOf(nodes: GraphNode[]): AtlasPlace[] {
  const out: AtlasPlace[] = [];
  for (const node of nodes) {
    // A borrowed point is the containing place's, not this record's: drawing
    // it would stack every unmapped temple on its city's centre.
    if (node.coordinateSource === 'inherited') continue;
    const lat = parseFloat(node.lat ?? '');
    const lon = parseFloat(node.long ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !within(lat, lon, NEPAL_BOUNDS)) continue;
    const year = parseTemporalAnchor(node.inceptionYear)?.year ?? null;
    out.push({ node, lat, lon, year, inValley: within(lat, lon, VALLEY_BOUNDS) });
  }
  return out;
}

export function eraOf(year: number | null): EraId {
  if (year == null) return 'undated';
  for (const e of ERAS) {
    if (e.id === 'undated') continue;
    if ((e.from == null || year >= e.from) && (e.to == null || year <= e.to)) return e.id;
  }
  return 'undated';
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearbyPlaces(place: AtlasPlace, places: AtlasPlace[], radiusKm: number, exclude: Set<string> = new Set()) {
  return places
    .filter((p) => p.node.id !== place.node.id && !exclude.has(p.node.id))
    .map((p) => ({ place: p, km: distanceKm(place, p) }))
    .filter((x) => x.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

// ── Elevation ──────────────────────────────────────────────────────────────────

export interface ElevationGrid {
  west: number;
  north: number;
  step: number;
  cols: number;
  rows: number;
  metres: string; // base64, little-endian uint16, row-major from the north-west corner
}

export interface DecodedGrid extends Omit<ElevationGrid, 'metres'> {
  values: Uint16Array;
}

export function decodeGrid(g: ElevationGrid): DecodedGrid {
  const raw = atob(g.metres);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const values = new Uint16Array(bytes.length / 2);
  for (let i = 0; i < values.length; i++) values[i] = bytes[2 * i] | (bytes[2 * i + 1] << 8);
  const { metres: _m, ...rest } = g;
  return { ...rest, values };
}

/** Bilinear elevation in metres, or null outside the grid. */
export function sampleGrid(g: DecodedGrid, lat: number, lon: number): number | null {
  const fx = (lon - g.west) / g.step;
  const fy = (g.north - lat) / g.step;
  if (fx < 0 || fy < 0 || fx > g.cols - 1 || fy > g.rows - 1) return null;
  const x = Math.min(g.cols - 2, Math.floor(fx));
  const y = Math.min(g.rows - 2, Math.floor(fy));
  const u = fx - x;
  const v = fy - y;
  const at = (cx: number, cy: number) => g.values[cy * g.cols + cx];
  return at(x, y) * (1 - u) * (1 - v) + at(x + 1, y) * u * (1 - v) + at(x, y + 1) * (1 - u) * v + at(x + 1, y + 1) * u * v;
}

/** Fine valley grid where it applies, the coarser Nepal grid elsewhere. */
export function elevationAt(grids: { nepal: DecodedGrid; valley: DecodedGrid } | null, lat: number, lon: number): number | null {
  if (!grids) return null;
  return sampleGrid(grids.valley, lat, lon) ?? sampleGrid(grids.nepal, lat, lon);
}

// ── Facts the map states ────────────────────────────────────────────────────────

export type MapFact =
  | { kind: 'valley'; count: number; total: number }
  | { kind: 'oldest'; place: AtlasPlace; year: number }
  | { kind: 'highest' | 'lowest'; place: AtlasPlace; metres: number }
  | { kind: 'gap'; westernmost: AtlasPlace };

/** West of this longitude, a collection with no records has a gap worth naming (Karnali and Sudurpashchim). */
const FAR_WEST = 82.5;

/**
 * Statements read off the places themselves, so they stay true as the
 * collection changes. Each names a place the visitor can open.
 */
export function mapFacts(places: AtlasPlace[], altitude: (p: AtlasPlace) => number | null): MapFact[] {
  if (!places.length) return [];
  const facts: MapFact[] = [];
  const valley = places.filter((p) => p.inValley).length;
  if (valley > 1) facts.push({ kind: 'valley', count: valley, total: places.length });
  const dated = places.filter((p) => p.year != null).sort((a, b) => a.year! - b.year!);
  if (dated.length) facts.push({ kind: 'oldest', place: dated[0], year: dated[0].year! });
  const high = places
    .map((p) => ({ p, m: altitude(p) }))
    .filter((x): x is { p: AtlasPlace; m: number } => x.m != null)
    .sort((a, b) => b.m - a.m);
  if (high.length > 1) {
    facts.push({ kind: 'highest', place: high[0].p, metres: high[0].m });
    facts.push({ kind: 'lowest', place: high[high.length - 1].p, metres: high[high.length - 1].m });
  }
  const westernmost = places.reduce((w, p) => (p.lon < w.lon ? p : w), places[0]);
  if (westernmost.lon > FAR_WEST) facts.push({ kind: 'gap', westernmost });
  return facts;
}

/** Round an altitude for display; the grids are ~200 m (valley) and ~2 km (country). */
export function roundAltitude(m: number): number {
  return Math.round(m / 10) * 10;
}
