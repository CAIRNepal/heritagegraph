import { Cartesian3 } from 'cesium';

import type { AtlasEntity } from '@/types/atlas';

// These curated city presets are the default "home regions" quick-jumps for the
// seeded Nepal corpus. They do not constrain global use: the globe's home/reset
// camera is driven by NEXT_PUBLIC_MAP_DEFAULT_* / NEXT_PUBLIC_GLOBE_DEFAULT_HEIGHT
// (see src/lib/map-config.ts). A deployment with a different corpus can supply its
// own presets here; treat this list as configurable sample data, not fixed UI.

export interface CityPreset {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** Camera height in meters above ellipsoid (approximate). */
  height: number;
  /** Heading radians — default ~12° */
  headingDeg?: number;
  pitchDeg: number;
  regionTag?: string;
}

export const CURATED_CITY_ORDER = [
  'kathmandu',
  'patan',
  'bhaktapur',
  'lumbini',
  'pokhara',
  'janakpur',
  'gorkha',
  'mustang',
  'world',
] as const;

const RAD = Math.PI / 180;

export const CURATED_CITIES: CityPreset[] = [
  {
    id: 'kathmandu',
    label: 'Kathmandu',
    lat: 27.7172,
    lon: 85.324,
    height: 16_000,
    headingDeg: 12,
    pitchDeg: -45,
    regionTag: 'valley',
  },
  {
    id: 'patan',
    label: 'Patan',
    lat: 27.6766,
    lon: 85.325,
    height: 10_000,
    headingDeg: 12,
    pitchDeg: -50,
    regionTag: 'valley',
  },
  {
    id: 'bhaktapur',
    label: 'Bhaktapur',
    lat: 27.671,
    lon: 85.4298,
    height: 10_000,
    headingDeg: 12,
    pitchDeg: -50,
    regionTag: 'valley',
  },
  {
    id: 'lumbini',
    label: 'Lumbini',
    lat: 27.4833,
    lon: 83.2756,
    height: 20_000,
    headingDeg: 12,
    pitchDeg: -45,
    regionTag: 'terai',
  },
  {
    id: 'pokhara',
    label: 'Pokhara',
    lat: 28.2096,
    lon: 83.9856,
    height: 35_000,
    headingDeg: 12,
    pitchDeg: -40,
    regionTag: 'midhill',
  },
  {
    id: 'janakpur',
    label: 'Janakpur',
    lat: 26.7288,
    lon: 85.9266,
    height: 20_000,
    headingDeg: 12,
    pitchDeg: -45,
    regionTag: 'terai',
  },
  {
    id: 'gorkha',
    label: 'Gorkha',
    lat: 28.0,
    lon: 84.6333,
    height: 25_000,
    headingDeg: 12,
    pitchDeg: -45,
    regionTag: 'midhill',
  },
  {
    id: 'mustang',
    label: 'Mustang',
    lat: 28.9985,
    lon: 83.8473,
    height: 60_000,
    headingDeg: 12,
    pitchDeg: -35,
    regionTag: 'highmountain',
  },
  {
    id: 'world',
    label: 'World view',
    lat: 27.0,
    lon: 85.0,
    height: 12_500_000,
    headingDeg: 0,
    pitchDeg: -90,
    regionTag: 'global',
  },
];

export function getCityById(id: string): CityPreset | undefined {
  return CURATED_CITIES.find((c) => c.id === id);
}

function havKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))));
}

/** Greedy clustering ~30 km for dummy corpus hotspots (counts entities per cluster). */
export function deriveDataDrivenCities(
  entities: AtlasEntity[],
  clusterKm = 30,
): CityPreset[] {
  const pts = entities.filter((e) => e.lat != null && e.lon != null);
  const used = new Set<number>();
  const out: CityPreset[] = [];

  for (let i = 0; i < pts.length; i++) {
    if (used.has(i)) continue;
    const seed = pts[i];
    if (seed.lat == null || seed.lon == null) continue;
    const group: AtlasEntity[] = [seed];
    used.add(i);
    for (let j = i + 1; j < pts.length; j++) {
      if (used.has(j)) continue;
      const o = pts[j];
      if (o.lat == null || o.lon == null) continue;
      if (havKm(seed.lat, seed.lon, o.lat, o.lon) <= clusterKm) {
        group.push(o);
        used.add(j);
      }
    }

    let sumLat = 0;
    let sumLon = 0;
    for (const g of group) {
      sumLat += g.lat ?? 0;
      sumLon += g.lon ?? 0;
    }
    const n = group.length;
    const clat = sumLat / n;
    const clon = sumLon / n;
    const primary =
      [...group].sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0] ?? seed;

    out.push({
      id: `auto-${Math.round(clat * 100)}-${Math.round(clon * 100)}`,
      label:
        n > 1
          ? `${primary?.name ?? 'Cluster'} (${String(n)})`
          : (primary?.name ?? 'Site'),
      lat: clat,
      lon: clon,
      height: Math.min(Math.max(8_500 * Math.sqrt(n), 6500), 120_000),
      headingDeg: 12,
      pitchDeg: -42,
      regionTag: 'derived',
    });
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}

export function distanceEstimateKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  return havKm(aLat, aLon, bLat, bLon);
}

export function estimateKmBetweenCartesian(a: Cartesian3, b: Cartesian3): number {
  return Cartesian3.distance(a, b) / 1000;
}
