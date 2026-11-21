// =================================================================
// Deployment-configurable map defaults
// =================================================================
// HeritageGraph ships with no geography baked into the UI. The default view
// is a neutral world view; a deployment re-homes the maps by setting:
//   NEXT_PUBLIC_MAP_DEFAULT_LAT, NEXT_PUBLIC_MAP_DEFAULT_LON,
//   NEXT_PUBLIC_MAP_DEFAULT_ZOOM   (Leaflet zoom, for the form picker)
//   NEXT_PUBLIC_GLOBE_DEFAULT_HEIGHT (Cesium camera height in metres, Atlas)
// e.g. for Nepal: LAT=27.7172 LON=85.324 ZOOM=7 HEIGHT=3950000
// =================================================================

function num(v: string | undefined, fallback: number): number {
  const n = v != null && String(v).trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export interface MapDefault {
  lat: number;
  lon: number;
  /** Leaflet zoom level for the contribute geo-point picker. */
  zoom: number;
}

/** Neutral world view unless overridden per deployment. */
export const MAP_DEFAULT: MapDefault = {
  lat: num(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT, 20),
  lon: num(process.env.NEXT_PUBLIC_MAP_DEFAULT_LON, 0),
  zoom: num(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM, 2),
};

/** Cesium (Atlas globe) home camera height in metres — high enough to show the
 *  whole globe by default. */
export const GLOBE_DEFAULT_HEIGHT = num(
  process.env.NEXT_PUBLIC_GLOBE_DEFAULT_HEIGHT,
  18_000_000,
);
