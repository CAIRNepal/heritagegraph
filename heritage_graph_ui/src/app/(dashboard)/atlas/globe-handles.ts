export interface AtlasGlobeHandles {
  flyToEntity: (id: string | null) => void;
  flyToCity: (id: string) => void;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  cycleFxPreset: (dir: -1 | 1) => void;
}
