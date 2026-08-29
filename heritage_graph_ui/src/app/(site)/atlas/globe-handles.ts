/** Imperative camera controls exposed by the globe to the atlas shell. */
export interface AtlasGlobeHandles {
  /** Cinematic flight to an entity (orbit → region → site). */
  flyToEntity: (id: string | null) => void;
  /** Cinematic flight to raw coordinates. */
  flyToCoords: (lon: number, lat: number, height?: number) => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}
