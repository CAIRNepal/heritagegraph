'use client';

import { useEffect, useRef } from 'react';

import {
  BoundingSphere,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ConstantProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  Entity as CesiumEntity,
  HeadingPitchRange,
  HorizontalOrigin,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  type Viewer as CesiumViewerType,
} from 'cesium';
import { useCesium } from 'resium';

import { atlasPrefersReducedMotion } from '@/lib/atlas-motion';
import { temporalGlobeAlpha } from '@/lib/atlas-temporal';
import type { AtlasEntity } from '@/types/atlas';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { clusterSprite, markerSprite, markerStyleForEntity } from './marker-config';

const BASE_SCALE = 0.42;
const ACTIVE_SCALE = 0.52;
const LABEL_NEAR_METERS = 260_000;

interface ClusterPickId {
  atlasCluster: true;
  positions: Cartesian3[];
}

function isClusterPick(id: unknown): id is ClusterPickId {
  return typeof id === 'object' && id != null && 'atlasCluster' in id;
}

/** Cached per-alpha tint colours to avoid per-frame allocations. */
const tintCache = new Map<number, Color>();
function tintForAlpha(alpha: number): Color {
  const bucket = Math.round(Math.max(0, Math.min(1, alpha)) * 20);
  let c = tintCache.get(bucket);
  if (!c) {
    c = Color.WHITE.withAlpha(bucket / 20);
    tintCache.set(bucket, c);
  }
  return c;
}

interface HeritageMarkersProps {
  entities: AtlasEntity[];
  relatedIds: ReadonlySet<string>;
}

/**
 * Glowing, clustered heritage markers.
 *
 * Rendered imperatively through a CustomDataSource (not per-entity React
 * components) so large corpora stay cheap: sprites are canvas-cached per
 * archetype, clusters use Cesium's screen-space EntityCluster, and temporal
 * fading is a shared CallbackProperty rather than a rebuild.
 */
export function HeritageMarkers({ entities, relatedIds }: HeritageMarkersProps) {
  const viewer = useCesium().viewer as CesiumViewerType | undefined;

  const dataSourceRef = useRef<CustomDataSource | null>(null);
  const colorByIdRef = useRef<Map<string, string>>(new Map());
  const activeIdsRef = useRef<Set<string>>(new Set());
  const entityIdsRef = useRef<Set<string>>(new Set());

  const selectedId = useAtlasStore((s) => s.selectedId);
  const hoveredEntityId = useAtlasStore((s) => s.hoveredEntityId);

  // ── Data source + clustering + picking (once per viewer) ────────────────────
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const ds = new CustomDataSource('heritage-markers');
    ds.clustering.enabled = true;
    ds.clustering.pixelRange = 52;
    ds.clustering.minimumClusterSize = 3;
    dataSourceRef.current = ds;
    void viewer.dataSources.add(ds);

    const removeClusterListener = ds.clustering.clusterEvent.addEventListener(
      (clustered, cluster) => {
        cluster.label.show = false;
        cluster.point.show = false;
        cluster.billboard.show = true;
        // Dominant archetype colour tints the cluster ring.
        const counts = new Map<string, number>();
        const positions: Cartesian3[] = [];
        for (const ent of clustered) {
          const color = colorByIdRef.current.get(ent.id) ?? '#38bdf8';
          counts.set(color, (counts.get(color) ?? 0) + 1);
          const pos = ent.position?.getValue(viewer.clock.currentTime);
          if (pos) positions.push(pos);
        }
        const dominant =
          [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#38bdf8';
        // Billboard.image is typed as string but accepts a canvas at runtime.
        cluster.billboard.image = clusterSprite(clustered.length, dominant) as unknown as string;
        cluster.billboard.scale = 0.5;
        cluster.billboard.verticalOrigin = VerticalOrigin.CENTER;
        cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
        cluster.billboard.id = { atlasCluster: true, positions } satisfies ClusterPickId;
      },
    );

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(movement.position);
      if (!picked) return;
      // Cluster → smooth split: fly to the cluster's bounding sphere.
      if (isClusterPick(picked.id)) {
        const sphere = BoundingSphere.fromPoints(picked.id.positions);
        viewer.camera.flyToBoundingSphere(sphere, {
          duration: atlasPrefersReducedMotion() ? 0 : 1.6,
          offset: new HeadingPitchRange(
            0,
            CesiumMath.toRadians(-58),
            Math.max(sphere.radius * 3.4, 24_000),
          ),
        });
        return;
      }
      if (picked.id instanceof CesiumEntity && entityIdsRef.current.has(picked.id.id)) {
        useAtlasStore.getState().selectEntity(picked.id.id);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      const picked = viewer.scene.pick(movement.endPosition);
      let id: string | null = null;
      let overCluster = false;
      if (picked) {
        if (isClusterPick(picked.id)) overCluster = true;
        else if (picked.id instanceof CesiumEntity && entityIdsRef.current.has(picked.id.id)) {
          id = picked.id.id;
        }
      }
      viewer.scene.canvas.style.cursor = id || overCluster ? 'pointer' : '';
      const rect = viewer.scene.canvas.getBoundingClientRect();
      useAtlasStore.getState().setHover(
        id,
        id
          ? {
              x: rect.left + movement.endPosition.x,
              y: rect.top + movement.endPosition.y,
            }
          : null,
      );
    }, ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      handler.destroy();
      removeClusterListener();
      if (!viewer.isDestroyed()) viewer.dataSources.remove(ds, true);
      dataSourceRef.current = null;
    };
  }, [viewer]);

  // ── Entity sync (on corpus / filter changes) ─────────────────────────────────
  useEffect(() => {
    const ds = dataSourceRef.current;
    if (!viewer || viewer.isDestroyed() || !ds) return;

    ds.entities.suspendEvents();
    ds.entities.removeAll();

    const colorById = new Map<string, string>();
    const ids = new Set<string>();

    for (const row of entities) {
      if (row.lat == null || row.lon == null) continue;
      const style = markerStyleForEntity(row);
      colorById.set(row.id, style.color);
      ids.add(row.id);

      const rowRef = row;
      ds.entities.add({
        id: row.id,
        position: Cartesian3.fromDegrees(row.lon, row.lat, Math.max(row.height ?? 90, 40)),
        billboard: {
          image: markerSprite(style.id, style.color, 'base'),
          scale: BASE_SCALE,
          verticalOrigin: VerticalOrigin.CENTER,
          horizontalOrigin: HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new NearFarScalar(3.2e5, 1.05, 2.6e7, 0.55),
          // Temporal fade follows the timeline year without entity rebuilds.
          color: new CallbackProperty(() => {
            const st = useAtlasStore.getState();
            return tintForAlpha(
              st.temporalFilterEnabled ? temporalGlobeAlpha(rowRef, st.currentYear) : 1,
            );
          }, false),
        },
        label: {
          text: row.name,
          font: '500 13px Poppins, ui-sans-serif, system-ui, sans-serif',
          fillColor: Color.WHITE.withAlpha(0.94),
          outlineColor: Color.fromCssColorString('#060b16').withAlpha(0.9),
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.TOP,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, 16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new DistanceDisplayCondition(0, LABEL_NEAR_METERS),
        },
      });
    }

    colorByIdRef.current = colorById;
    entityIdsRef.current = ids;
    activeIdsRef.current = new Set();
    ds.entities.resumeEvents();
    viewer.scene.requestRender();
  }, [viewer, entities]);

  // ── Active state diffing (hover / selection / knowledge-graph context) ──────
  useEffect(() => {
    const ds = dataSourceRef.current;
    if (!viewer || viewer.isDestroyed() || !ds) return;

    const nextActive = new Set<string>();
    if (selectedId) nextActive.add(selectedId);
    if (hoveredEntityId) nextActive.add(hoveredEntityId);
    for (const id of relatedIds) nextActive.add(id);

    const touched = new Set([...nextActive, ...activeIdsRef.current]);
    const reduced = atlasPrefersReducedMotion();

    for (const id of touched) {
      const ent = ds.entities.getById(id);
      if (!ent?.billboard) continue;
      const color = colorByIdRef.current.get(id) ?? '#38bdf8';
      const row = entities.find((e) => e.id === id);
      const archetype = row ? markerStyleForEntity(row).id : 'temple';
      const isActive = nextActive.has(id);
      const isFocus = id === selectedId || id === hoveredEntityId;

      ent.billboard.image = new ConstantProperty(
        markerSprite(archetype, color, isActive ? 'active' : 'base'),
      );

      if (isFocus && !reduced) {
        // Gentle breathing pulse — only on the one or two focused markers.
        const phase = performance.now();
        ent.billboard.scale = new CallbackProperty(
          () => ACTIVE_SCALE + 0.05 * Math.sin((performance.now() - phase) / 420),
          false,
        );
      } else {
        ent.billboard.scale = new ConstantProperty(isActive ? ACTIVE_SCALE : BASE_SCALE);
      }

      if (ent.label) {
        // Selected/related labels stay visible from any distance.
        ent.label.distanceDisplayCondition = new ConstantProperty(
          isActive
            ? new DistanceDisplayCondition(0, 4.0e7)
            : new DistanceDisplayCondition(0, LABEL_NEAR_METERS),
        );
      }
    }

    activeIdsRef.current = nextActive;
    viewer.scene.requestRender();
  }, [viewer, entities, selectedId, hoveredEntityId, relatedIds]);

  return null;
}
