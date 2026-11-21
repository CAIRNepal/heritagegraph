'use client';

import { useCallback, useEffect, useState } from 'react';

import type { ReliefMeta } from '@/app/(site)/atlas/components/AtlasMap';

import { decodeGrid, elevationAt, type DecodedGrid, type ElevationGrid } from './atlas-model';

interface ReliefFile extends ReliefMeta {
  elevation: { nepal: ElevationGrid; valley: ElevationGrid };
}

export interface AtlasRelief {
  /** Hillshade overlays for the map; null until loaded. */
  relief: ReliefMeta | null;
  /** Elevation in metres at a point, from the SRTM-derived grid; null when unknown. */
  altitudeAt: (lat: number, lon: number) => number | null;
}

// Fetched once per page load and shared: the map draws the hillshade, the
// record panel reads altitude from the same grid.
let pending: Promise<{ relief: ReliefMeta; grids: { nepal: DecodedGrid; valley: DecodedGrid } }> | null = null;

function loadRelief() {
  if (!pending) {
    pending = fetch('/atlas/relief.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`relief ${r.status}`))))
      .then((f: ReliefFile) => ({
        relief: { nepal: f.nepal, valley: f.valley },
        grids: { nepal: decodeGrid(f.elevation.nepal), valley: decodeGrid(f.elevation.valley) },
      }))
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

export function useAtlasRelief(): AtlasRelief {
  const [state, setState] = useState<{ relief: ReliefMeta; grids: { nepal: DecodedGrid; valley: DecodedGrid } } | null>(null);
  useEffect(() => {
    let alive = true;
    loadRelief()
      .then((s) => alive && setState(s))
      .catch((err) => console.error('atlas: relief failed to load', err));
    return () => {
      alive = false;
    };
  }, []);
  const altitudeAt = useCallback((lat: number, lon: number) => elevationAt(state?.grids ?? null, lat, lon), [state]);
  return { relief: state?.relief ?? null, altitudeAt };
}
