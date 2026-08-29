'use client';

import type { RefObject } from 'react';
import { useMemo } from 'react';

import { useShallow } from 'zustand/react/shallow';

import type { AtlasGlobeHandles } from '@/app/(site)/atlas/globe-handles';

import { CesiumAssetsGate } from '../components/cesium-assets-gate';
import { EarthScene } from '../components/HeritageGlobe/EarthScene';
import { useAtlasStore } from '../hooks/use-atlas-store';

interface GlobeViewProps {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
}

/**
 * Binds the store to the Cesium scene: filtered globe entities plus the
 * knowledge-graph neighbourhood of the current selection (for glow + arcs).
 */
export function GlobeView({ globeHandlesRef }: GlobeViewProps) {
  const entities = useAtlasStore(useShallow((s) => s.getGlobeEntities()));
  const selectedId = useAtlasStore((s) => s.selectedId);
  const edges = useAtlasStore((s) => s.edges);

  const relatedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedId) return ids;
    for (const edge of edges) {
      if (edge.source === selectedId) ids.add(edge.target);
      else if (edge.target === selectedId) ids.add(edge.source);
    }
    return ids;
  }, [edges, selectedId]);

  return (
    <CesiumAssetsGate>
      <EarthScene
        globeHandlesRef={globeHandlesRef}
        entities={entities}
        relatedIds={relatedIds}
      />
    </CesiumAssetsGate>
  );
}
