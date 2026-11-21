/**
 * Shared Leaflet raster tile settings + CSP host allowlist (see next.config.ts).
 */

/**
 * Basemap for the Heritage Museum map.
 *
 * CARTO's basemaps (dark_all, light_all, voyager) now answer unkeyed requests
 * with an "API KEY REQUIRED" watermark tile, which turned the whole map into
 * that watermark. The default is OpenStreetMap's standard layer, whose tile
 * policy allows light use with attribution. For production traffic set
 * NEXT_PUBLIC_MAP_TILE_URL (and NEXT_PUBLIC_MAP_TILE_ATTRIBUTION) to a keyed
 * provider; the URL's host is added to the CSP automatically.
 */
const CUSTOM_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim();

export const HERITAGE_MUSEUM_TILE_LAYER = {
  url: CUSTOM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim() ||
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
} as const;

export const OPENSTREETMAP_TILE_LAYER = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap',
  maxZoom: 19,
} as const;

/** `https://{s}.tiles.example.com/...` → `https://*.tiles.example.com`. */
function cspOrigin(template: string | undefined): string | null {
  const origin = template?.match(/^https:\/\/[^/]+/)?.[0];
  return origin ? origin.replace('{s}.', '*.') : null;
}

const customOrigin = cspOrigin(CUSTOM_TILE_URL);

/** Hosts that must appear in connect-src and img-src for Leaflet basemaps. */
export const LEAFLET_TILE_CSP_HOSTS = [
  'https://*.basemaps.cartocdn.com',
  'https://basemaps.cartocdn.com',
  'https://*.tile.openstreetmap.org',
  'https://tile.openstreetmap.org',
  'https://*.openstreetmap.org',
  ...(customOrigin ? [customOrigin] : []),
] as const;
