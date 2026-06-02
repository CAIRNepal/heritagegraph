/**
 * Shared Leaflet raster tile settings + CSP host allowlist (see next.config.ts).
 */

export const HERITAGE_MUSEUM_TILE_LAYER = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution: '© OpenStreetMap © CARTO',
  subdomains: 'abcd',
  maxZoom: 19,
} as const;

export const OPENSTREETMAP_TILE_LAYER = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap',
  maxZoom: 19,
} as const;

/** Hosts that must appear in connect-src and img-src for Leaflet basemaps. */
export const LEAFLET_TILE_CSP_HOSTS = [
  'https://*.basemaps.cartocdn.com',
  'https://basemaps.cartocdn.com',
  'https://*.tile.openstreetmap.org',
  'https://tile.openstreetmap.org',
  'https://*.openstreetmap.org',
] as const;
