/**
 * Imagery layer catalog for the Heritage Atlas globe.
 * All providers are keyless public tile services (no Cesium Ion token needed).
 */

export type AtlasImageryLayerId = 'satellite' | 'terrain' | 'political' | 'dark';

export interface AtlasImageryLayerDef {
  id: AtlasImageryLayerId;
  label: string;
  description: string;
  url: string;
  credit: string;
  maximumLevel: number;
}

export const ATLAS_IMAGERY_LAYERS: AtlasImageryLayerDef[] = [
  {
    id: 'satellite',
    label: 'Satellite',
    description: 'Esri World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    credit: 'Esri, Maxar, Earthstar Geographics and GIS community',
    maximumLevel: 18,
  },
  {
    id: 'terrain',
    label: 'Terrain',
    description: 'Esri physical relief',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    credit: 'Esri, US National Park Service',
    maximumLevel: 8,
  },
  {
    id: 'political',
    label: 'Political',
    description: 'CARTO Voyager basemap',
    url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    credit: '© OpenStreetMap contributors © CARTO',
    maximumLevel: 18,
  },
  {
    id: 'dark',
    label: 'Historical',
    description: 'CARTO dark — night atlas mood',
    url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    credit: '© OpenStreetMap contributors © CARTO',
    maximumLevel: 18,
  },
];

export function getImageryLayerDef(id: AtlasImageryLayerId): AtlasImageryLayerDef {
  return ATLAS_IMAGERY_LAYERS.find((l) => l.id === id) ?? ATLAS_IMAGERY_LAYERS[0];
}

/** NASA Black Marble city lights — blended onto the night side of the globe. */
export const NIGHT_LIGHTS_LAYER = {
  url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
  credit: 'NASA Earth Observatory / VIIRS Black Marble',
  maximumLevel: 8,
} as const;

/** Faint reference boundaries + place labels overlay. */
export const BOUNDARIES_LAYER = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  credit: 'Esri reference overlay',
  maximumLevel: 18,
} as const;
