'use client';

import { useEffect, useRef } from 'react';

import {
  CallbackProperty,
  Cartesian3,
  Color,
  CustomDataSource,
  PolylineGlowMaterialProperty,
  type Viewer as CesiumViewerType,
} from 'cesium';
import { useCesium } from 'resium';

import { atlasPrefersReducedMotion } from '@/lib/atlas-motion';
import type { AtlasEntity } from '@/types/atlas';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { markerStyleForEntity } from './marker-config';

const MAX_ARCS = 14;
const ARC_SAMPLES = 56;
const DRAW_IN_MS = 950;

/** Great-circle samples between two points with a parabolic altitude bump. */
function arcPositions(
  from: { lon: number; lat: number },
  to: { lon: number; lat: number },
): Cartesian3[] {
  const start = Cartesian3.fromDegrees(from.lon, from.lat, 0);
  const end = Cartesian3.fromDegrees(to.lon, to.lat, 0);
  const distance = Cartesian3.distance(start, end);
  const peak = Math.min(420_000, Math.max(14_000, distance * 0.18));

  const positions: Cartesian3[] = [];
  for (let i = 0; i <= ARC_SAMPLES; i += 1) {
    const t = i / ARC_SAMPLES;
    // Spherical interpolation via normalized lerp (fine at these distances).
    const p = Cartesian3.lerp(start, end, t, new Cartesian3());
    Cartesian3.normalize(p, p);
    const surface = Cartesian3.multiplyByScalar(p, 6_378_137, new Cartesian3());
    const altitude = peak * 4 * t * (1 - t) + 400;
    const up = Cartesian3.normalize(surface, new Cartesian3());
    Cartesian3.add(
      surface,
      Cartesian3.multiplyByScalar(up, altitude, new Cartesian3()),
      surface,
    );
    positions.push(surface);
  }
  return positions;
}

interface ConnectionArcsProps {
  entities: AtlasEntity[];
  relatedIds: ReadonlySet<string>;
}

/**
 * Contextual knowledge-graph arcs: when an entity is selected, animated glow
 * lines sweep out to its related entities on the globe. Only the selection's
 * neighbourhood is drawn — never the whole graph.
 */
export function ConnectionArcs({ entities, relatedIds }: ConnectionArcsProps) {
  const viewer = useCesium().viewer as CesiumViewerType | undefined;
  const selectedId = useAtlasStore((s) => s.selectedId);
  const dsRef = useRef<CustomDataSource | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const ds = new CustomDataSource('heritage-arcs');
    dsRef.current = ds;
    void viewer.dataSources.add(ds);
    return () => {
      if (!viewer.isDestroyed()) viewer.dataSources.remove(ds, true);
      dsRef.current = null;
    };
  }, [viewer]);

  useEffect(() => {
    const ds = dsRef.current;
    if (!viewer || viewer.isDestroyed() || !ds) return;

    ds.entities.removeAll();
    if (!selectedId) return;

    const origin = entities.find((e) => e.id === selectedId);
    if (!origin || origin.lat == null || origin.lon == null) return;

    const targets = entities
      .filter(
        (e) =>
          relatedIds.has(e.id) && e.id !== selectedId && e.lat != null && e.lon != null,
      )
      .slice(0, MAX_ARCS);
    if (targets.length === 0) return;

    const mountedAt = performance.now();
    const reduced = atlasPrefersReducedMotion();

    for (const target of targets) {
      const full = arcPositions(
        { lon: origin.lon, lat: origin.lat },
        { lon: target.lon!, lat: target.lat! },
      );
      const color = Color.fromCssColorString(markerStyleForEntity(target).color);

      ds.entities.add({
        id: `arc:${selectedId}:${target.id}`,
        polyline: {
          // Draw-in animation: the arc grows from origin to target.
          positions: reduced
            ? full
            : new CallbackProperty(() => {
                const t = Math.min(1, (performance.now() - mountedAt) / DRAW_IN_MS);
                const eased = 1 - (1 - t) ** 3;
                const n = Math.max(2, Math.ceil(eased * full.length));
                return full.slice(0, n);
              }, false),
          width: 7,
          material: new PolylineGlowMaterialProperty({
            glowPower: 0.28,
            taperPower: 0.6,
            color: reduced
              ? color.withAlpha(0.85)
              : new CallbackProperty(
                  () =>
                    color.withAlpha(
                      0.66 + 0.22 * Math.sin((performance.now() - mountedAt) / 640),
                    ),
                  false,
                ),
          }),
          clampToGround: false,
        },
      });
    }
    viewer.scene.requestRender();
  }, [viewer, entities, selectedId, relatedIds]);

  return null;
}
