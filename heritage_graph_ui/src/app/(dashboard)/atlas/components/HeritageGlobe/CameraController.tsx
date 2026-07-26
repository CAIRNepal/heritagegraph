'use client';

import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import {
  Cartesian3,
  Cartographic,
  EasingFunction,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Cartesian2,
  type Viewer as CesiumViewerType,
} from 'cesium';
import { useCesium } from 'resium';

import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';
import { atlasPrefersReducedMotion } from '@/lib/atlas-motion';
import { GLOBE_DEFAULT_HEIGHT, MAP_DEFAULT } from '@/lib/map-config';
import type { AtlasEntity } from '@/types/atlas';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import { markerStyleForEntity } from './marker-config';

const DEFAULT_HEADING_DEG = 0;
const DEFAULT_PITCH_DEG = -90;
const SITE_PITCH_DEG = -42;

/** Idle time before the globe starts its ambient rotation. */
const IDLE_ROTATE_AFTER_MS = 14_000;
const IDLE_ROTATE_MIN_HEIGHT_M = 5_500_000;
/** Radians per second of ambient rotation (slow, museum-display pace). */
const IDLE_ROTATE_RATE = 0.012;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function estimateKm(a: Cartesian3, b: Cartesian3): number {
  return Cartesian3.distance(a, b) / 1000;
}

/** Cinematic flight duration — long-haul flights breathe, short hops stay snappy. */
function flightDuration(distKm: number): number {
  if (atlasPrefersReducedMotion()) return 0;
  return clamp(1.5 + distKm / 6_500, 1.5, 5.4);
}

/** Arc apex for long-haul flights so the camera sweeps up through orbit. */
function flightArc(distKm: number): number | undefined {
  return distKm > 1200 ? clamp(1_500_000 + distKm * 850, 0, 11_000_000) : undefined;
}

/** How close the camera should settle for a given entity kind. */
function approachHeightMeters(entity: AtlasEntity): number {
  const archetype = markerStyleForEntity(entity).id;
  switch (archetype) {
    case 'temple':
    case 'monastery':
    case 'architecture':
    case 'artifact':
      return 2_600;
    case 'event':
      return 60_000;
    default:
      return 18_000;
  }
}

interface CameraControllerProps {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
  entities: AtlasEntity[];
}

/**
 * All camera behaviour: cinematic flights (never teleports), ambient idle
 * rotation, double-click fly-to, and throttled camera telemetry for the
 * mini-map. Must be mounted inside the resium <Viewer>.
 */
export function CameraController({ globeHandlesRef, entities }: CameraControllerProps) {
  const viewer = useCesium().viewer as CesiumViewerType | undefined;

  const entitiesRef = useRef(entities);
  entitiesRef.current = entities;

  const lastInteractionRef = useRef<number>(Date.now());
  const flyingRef = useRef(false);

  const flyToPosition = useCallback(
    (dest: Cartesian3, pitchDeg: number, headingDeg = DEFAULT_HEADING_DEG) => {
      if (!viewer || viewer.isDestroyed()) return;
      const distKm = estimateKm(viewer.camera.position, dest);
      const maxH = flightArc(distKm);
      lastInteractionRef.current = Date.now();
      flyingRef.current = true;
      viewer.camera.flyTo({
        destination: dest,
        orientation: {
          heading: CesiumMath.toRadians(headingDeg),
          pitch: CesiumMath.toRadians(pitchDeg),
          roll: 0,
        },
        duration: flightDuration(distKm),
        easingFunction: EasingFunction.QUARTIC_IN_OUT,
        maximumHeight: maxH,
        pitchAdjustHeight: maxH ? Math.max(200_000, maxH * 0.05) : undefined,
        complete: () => {
          flyingRef.current = false;
          lastInteractionRef.current = Date.now();
        },
        cancel: () => {
          flyingRef.current = false;
          lastInteractionRef.current = Date.now();
        },
      });
    },
    [viewer],
  );

  const flyToEntity = useCallback(
    (id: string | null) => {
      if (!id) return;
      const row = entitiesRef.current.find((e) => e.id === id);
      if (!row || row.lat == null || row.lon == null) return;
      const height = approachHeightMeters(row);
      // Approach slightly south of the site so the tilted camera frames it.
      const latOffset = height < 10_000 ? -0.012 : 0;
      const dest = Cartesian3.fromDegrees(row.lon, row.lat + latOffset, height);
      flyToPosition(dest, height < 10_000 ? SITE_PITCH_DEG : -62);
    },
    [flyToPosition],
  );

  const flyToCoords = useCallback(
    (lon: number, lat: number, height = 60_000) => {
      flyToPosition(Cartesian3.fromDegrees(lon, lat, height), height < 10_000 ? SITE_PITCH_DEG : -62);
    },
    [flyToPosition],
  );

  const resetView = useCallback(() => {
    flyToPosition(
      Cartesian3.fromDegrees(MAP_DEFAULT.lon, MAP_DEFAULT.lat, GLOBE_DEFAULT_HEIGHT),
      DEFAULT_PITCH_DEG,
    );
  }, [flyToPosition]);

  const zoomIn = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;
    lastInteractionRef.current = Date.now();
    const h = viewer.camera.positionCartographic.height;
    viewer.camera.zoomIn(h * 0.45);
  }, [viewer]);

  const zoomOut = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;
    lastInteractionRef.current = Date.now();
    const h = viewer.camera.positionCartographic.height;
    viewer.camera.zoomOut(h * 0.8);
  }, [viewer]);

  // Expose handles to the shell.
  useEffect(() => {
    globeHandlesRef.current = { flyToEntity, flyToCoords, resetView, zoomIn, zoomOut };
    return () => {
      globeHandlesRef.current = null;
    };
  }, [globeHandlesRef, flyToEntity, flyToCoords, resetView, zoomIn, zoomOut]);

  // Initial framing.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    resetView();
    // Mount-only: initial establishing shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  // Fly whenever the selection changes.
  const selectedId = useAtlasStore((s) => s.selectedId);
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !selectedId) return;
    flyToEntity(selectedId);
  }, [viewer, selectedId, flyToEntity]);

  // User interaction tracking (pauses ambient rotation).
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const canvas = viewer.scene.canvas;
    const bump = () => {
      lastInteractionRef.current = Date.now();
    };
    canvas.addEventListener('pointerdown', bump);
    canvas.addEventListener('wheel', bump, { passive: true });
    canvas.addEventListener('touchstart', bump, { passive: true });
    return () => {
      canvas.removeEventListener('pointerdown', bump);
      canvas.removeEventListener('wheel', bump);
      canvas.removeEventListener('touchstart', bump);
    };
  }, [viewer]);

  // Ambient idle rotation — a living globe when nobody is driving.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    let lastTime = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      if (flyingRef.current) return;
      if (atlasPrefersReducedMotion()) return;
      if (Date.now() - lastInteractionRef.current < IDLE_ROTATE_AFTER_MS) return;
      const atlas = useAtlasStore.getState();
      const ui = useAtlasUiStore.getState();
      if (atlas.selectedId || ui.story.active || ui.spotlightOpen) return;
      if (viewer.camera.positionCartographic.height < IDLE_ROTATE_MIN_HEIGHT_M) return;
      viewer.scene.camera.rotate(Cartesian3.UNIT_Z, -IDLE_ROTATE_RATE * dt);
    };
    viewer.scene.preUpdate.addEventListener(tick);
    return () => {
      if (!viewer.isDestroyed()) viewer.scene.preUpdate.removeEventListener(tick);
    };
  }, [viewer]);

  // Double-click anywhere: cinematic dive toward the picked point.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: { position: Cartesian2 }) => {
      const ray = viewer.camera.getPickRay(movement.position);
      const picked = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
      if (!picked) return;
      const carto = Cartographic.fromCartesian(picked);
      const currentH = viewer.camera.positionCartographic.height;
      const targetH = Math.max(3_200, currentH * 0.22);
      flyToPosition(
        Cartesian3.fromDegrees(
          CesiumMath.toDegrees(carto.longitude),
          CesiumMath.toDegrees(carto.latitude),
          targetH,
        ),
        targetH < 100_000 ? -55 : DEFAULT_PITCH_DEG,
      );
    }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    return () => {
      handler.destroy();
    };
  }, [viewer, flyToPosition]);

  // Throttled camera telemetry for the mini-map.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    let lastPush = 0;
    const push = () => {
      const now = Date.now();
      if (now - lastPush < 180) return;
      lastPush = now;
      const c = viewer.camera.positionCartographic;
      useAtlasUiStore.getState().setCameraCenter({
        lat: CesiumMath.toDegrees(c.latitude),
        lon: CesiumMath.toDegrees(c.longitude),
        height: c.height,
      });
    };
    viewer.camera.percentageChanged = 0.01;
    viewer.camera.changed.addEventListener(push);
    viewer.camera.moveEnd.addEventListener(push);
    push();
    return () => {
      if (viewer.isDestroyed()) return;
      viewer.camera.changed.removeEventListener(push);
      viewer.camera.moveEnd.removeEventListener(push);
    };
  }, [viewer]);

  return null;
}
