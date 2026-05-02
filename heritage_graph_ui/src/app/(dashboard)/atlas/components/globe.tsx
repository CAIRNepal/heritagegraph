'use client';

/* Side-effect MUST run before Cesium resolves worker URLs (see public/cesium). */
import '@/app/(dashboard)/atlas/cesium-base-url';

import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  EasingFunction,
  EllipsoidTerrainProvider,
  HorizontalOrigin,
  Ion,
  LabelStyle,
  Math as CesiumMath,
  NearFarScalar,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  VerticalOrigin,
  CallbackProperty,
  HeightReference,
  type Viewer as CesiumViewerType,
} from 'cesium';
import { Entity, ScreenSpaceCameraController, Viewer, useCesium } from 'resium';
import { useShallow } from 'zustand/react/shallow';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';
import { colorForOntologyClass } from '@/lib/atlas-globe-colors';
import type { AtlasEntity } from '@/types/atlas';

import { useAtlasStore } from '../hooks/use-atlas-store';
import { GlobeFxStack } from './globe-fx-stack';
import {
  deriveDataDrivenCities,
  estimateKmBetweenCartesian,
  getCityById,
} from '../lib/atlas-cities';

// Suppress Ion service requests — we use Esri tiles directly.
// A real token can be supplied via NEXT_PUBLIC_CESIUM_ION_ACCESS_TOKEN if needed.
Ion.defaultAccessToken =
  process.env.NEXT_PUBLIC_CESIUM_ION_ACCESS_TOKEN ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS0zMzI3MzM2NTY4ZjgiLCJpZCI6NTkyMTMsImlhdCI6MTYyNzE0NDYyMn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk';

const ellipsoidTerrain = new EllipsoidTerrainProvider();

/** Aligns with UrlTemplateImageryProvider maximumLevel — avoid Esri "no data" tiles at extreme zoom. */
const ESRI_IMAGERY_MAX_LEVEL = 18;

// ─── Flight helpers ────────────────────────────────────────────────────────────

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Duration in seconds for a flight of `distKm` km. Smooth quartic ease. */
function flightDuration(distKm: number): number {
  return clamp(0.9 + distKm / 12_000, 0.9, 2.6);
}

/** Arc peak for long-haul flights — undefined for short ones (no arc needed). */
function maxFlightHeight(distKm: number): number | undefined {
  return distKm > 1500 ? clamp(1_300_000 + distKm * 900, 0, 9_500_000) : undefined;
}

const DEFAULT_PITCH_DEG = -52;
const DEFAULT_HEADING_DEG = 12;

/** Check user preference — skip animation when reduced-motion is requested. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ─── Point sizing ──────────────────────────────────────────────────────────────

function ontologyEntityPointPixels(
  entity: AtlasEntity,
  selectedId: string | null,
  hoveredId: string | null,
  currentYear: number,
): number {
  const selected = entity.id === selectedId;
  const hovered = entity.id === hoveredId;
  let base = hovered ? 14 : selected ? 13 : 10;
  const hasEvent = entity.events.some((ev) => ev.year <= currentYear);
  const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const pulse = hasEvent ? Math.sin(t / 950) : 0;
  if (hasEvent) base += 2 * pulse;
  return Math.max(4, Math.min(22, base));
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ViewerCaptureBridge({
  onViewer,
}: {
  onViewer: (v: CesiumViewerType | null) => void;
}) {
  const { viewer } = useCesium();
  useEffect(() => {
    if (!viewer) return;
    const v = viewer as CesiumViewerType;
    onViewer(v);
    return () => onViewer(null);
  }, [viewer, onViewer]);
  return null;
}

function InstallImageryLayers({
  baseProvider,
  overlayProvider,
}: {
  baseProvider: UrlTemplateImageryProvider;
  overlayProvider: UrlTemplateImageryProvider;
}) {
  const { viewer } = useCesium();
  useEffect(() => {
    if (!viewer?.imageryLayers) return;
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(baseProvider);
    const overlayLayer = viewer.imageryLayers.addImageryProvider(overlayProvider);
    overlayLayer.alpha = 0.42;
    viewer.scene?.requestRender();
  }, [viewer, baseProvider, overlayProvider]);
  return null;
}

function AtlasGlobeInteractionBridge({ entities }: { entities: AtlasEntity[] }) {
  const viewer = useCesium().viewer as CesiumViewerType | undefined;

  const currentYear = useAtlasStore((s) => s.currentYear);
  const selectedId = useAtlasStore((s) => s.selectedId);
  const hoveredEntityId = useAtlasStore((s) => s.hoveredEntityId);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const setHover = useAtlasStore((s) => s.setHover);

  useEffect(() => {
    if (!viewer) return;
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

    handler.setInputAction((movement: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(movement.position);
      if (picked && picked.id && typeof picked.id === 'object' && 'id' in picked.id) {
        const raw = (picked.id as { id?: unknown }).id;
        if (typeof raw === 'string' && entities.some((s) => s.id === raw)) {
          selectEntity(raw);
        }
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      const picked = viewer.scene.pick(movement.endPosition);
      let id: string | null = null;
      if (picked && picked.id && typeof picked.id === 'object' && 'id' in picked.id) {
        const raw = (picked.id as { id?: unknown }).id;
        if (typeof raw === 'string' && entities.some((s) => s.id === raw)) {
          id = raw;
        }
      }
      const canvas = viewer.scene.canvas;
      const rect = canvas.getBoundingClientRect();
      setHover(id, {
        x: rect.left + movement.endPosition.x,
        y: rect.top + movement.endPosition.y,
      });
    }, ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      handler.destroy();
    };
  }, [viewer, entities, selectEntity, setHover]);

  // Keep requestRender() in sync with any state that should trigger a scene repaint.
  // requestRenderMode is disabled on the Viewer so Cesium renders continuously; this
  // call is kept as a belt-and-suspenders signal for state-driven repaints.
  useEffect(() => {
    if (!viewer?.scene) return;
    viewer.scene.requestRender();
  }, [viewer, currentYear, selectedId, hoveredEntityId]);

  return null;
}

// ─── Main globe ────────────────────────────────────────────────────────────────

interface AtlasGlobeProps {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
}

export function AtlasGlobe({ globeHandlesRef }: AtlasGlobeProps) {
  const entities = useAtlasStore(useShallow((s) => s.getGlobeEntities()));
  const allEntities = useAtlasStore(useShallow((s) => s.entities));
  const selectedId = useAtlasStore((s) => s.selectedId);
  const hoveredEntityId = useAtlasStore((s) => s.hoveredEntityId);
  const currentYear = useAtlasStore((s) => s.currentYear);

  const viewerRef = useRef<CesiumViewerType | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [creditHostElement, setCreditHostElement] = useState<HTMLElement | null>(null);

  const esriImagery = useMemo(
    () =>
      new UrlTemplateImageryProvider({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        credit: 'Esri, Maxar, Earthstar Geographics and GIS community',
        maximumLevel: ESRI_IMAGERY_MAX_LEVEL,
      }),
    [],
  );

  const esriLabels = useMemo(
    () =>
      new UrlTemplateImageryProvider({
        url:
          'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        credit: 'Esri reference overlay',
        maximumLevel: ESRI_IMAGERY_MAX_LEVEL,
      }),
    [],
  );

  const filteredIds = useMemo(() => new Set(entities.map((s) => s.id)), [entities]);

  const buildOrientation = useCallback((headingDeg = DEFAULT_HEADING_DEG, pitchDeg = DEFAULT_PITCH_DEG) => {
    return {
      heading: CesiumMath.toRadians(headingDeg),
      pitch: CesiumMath.toRadians(pitchDeg),
      roll: 0,
    };
  }, []);

  /** Shared flyTo core — consistent easing, duration, and arc for all flights. */
  const flyToPosition = useCallback(
    (dest: Cartesian3, headingDeg?: number, pitchDeg?: number) => {
      const v = viewerRef.current;
      if (!v) return;
      const distKm = estimateKmBetweenCartesian(v.camera.position, dest);
      const duration = prefersReducedMotion() ? 0 : flightDuration(distKm);
      const maxH = maxFlightHeight(distKm);
      void v.camera.flyTo({
        destination: dest,
        orientation: buildOrientation(headingDeg, pitchDeg),
        duration,
        easingFunction: EasingFunction.QUARTIC_IN_OUT,
        maximumHeight: maxH,
        pitchAdjustHeight: maxH ? Math.max(160_000, maxH * 0.04) : undefined,
      });
    },
    [buildOrientation],
  );

  const flyToEntity = useCallback(
    (id: string | null) => {
      const v = viewerRef.current;
      if (!v || !id) return;
      const entity = v.entities.getById(id);
      if (entity) {
        void v.flyTo(entity, { duration: prefersReducedMotion() ? 0 : 1.45 });
        return;
      }
      const row = entities.find((s) => s.id === id);
      if (!row || row.lat == null || row.lon == null) return;
      const dest = Cartesian3.fromDegrees(
        row.lon,
        row.lat,
        Math.max(row.height ?? 120, 40) + 2_200_000,
      );
      flyToPosition(dest);
    },
    [entities, flyToPosition],
  );

  const flyToCity = useCallback(
    (cityId: string) => {
      const v = viewerRef.current;
      if (!v) return;
      let target = getCityById(cityId);
      if (!target) {
        target = deriveDataDrivenCities(allEntities).find((c) => c.id === cityId);
      }
      if (!target) return;
      const dest = Cartesian3.fromDegrees(target.lon, target.lat, target.height);
      flyToPosition(dest, target.headingDeg ?? DEFAULT_HEADING_DEG, target.pitchDeg);
    },
    [allEntities, flyToPosition],
  );

  const resetView = useCallback(() => {
    flyToPosition(
      Cartesian3.fromDegrees(85.324, 27.716, 3_950_000),
      DEFAULT_HEADING_DEG,
      DEFAULT_PITCH_DEG,
    );
  }, [flyToPosition]);

  const zoomIn = useCallback(() => {
    viewerRef.current?.camera.zoomIn(2_450_000);
  }, []);

  const zoomOut = useCallback(() => {
    viewerRef.current?.camera.zoomOut(2_450_000);
  }, []);

  const setViewerFromBridge = useCallback((v: CesiumViewerType | null) => {
    viewerRef.current = v;
    setViewerReady(!!v);
    if (v?.scene?.postProcessStages?.fxaa) {
      v.scene.postProcessStages.fxaa.enabled = true;
    }
  }, []);

  useEffect(() => {
    const cycleFxPreset = useAtlasStore.getState().cycleFxPreset;
    globeHandlesRef.current = {
      flyToEntity,
      flyToCity,
      resetView,
      zoomIn,
      zoomOut,
      cycleFxPreset,
    };
    return () => {
      globeHandlesRef.current = null;
    };
  }, [globeHandlesRef, flyToEntity, flyToCity, resetView, zoomIn, zoomOut]);

  // Fly to the heritage region (Nepal/South Asia) as soon as the globe is ready.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!viewerReady) return;
    resetView();
  }, [viewerReady]);

  useEffect(() => {
    if (!viewerReady || !selectedId || !filteredIds.has(selectedId)) return;
    flyToEntity(selectedId);
  }, [viewerReady, selectedId, filteredIds, flyToEntity]);

  const reconciliationOutline = (status: string): Color => {
    switch (status) {
      case 'conflicting':
        return Color.fromCssColorString('#e5544b').withAlpha(0.95);
      case 'unverified':
        return Color.fromCssColorString('#f59e0b').withAlpha(0.88);
      default:
        return Color.fromCssColorString('#22c55e').withAlpha(0.85);
    }
  };

  return (
    <>
      <div
        ref={setCreditHostElement}
        aria-hidden
        className="sr-only absolute h-px w-px overflow-hidden border-0 p-0"
      />
      {creditHostElement ?
        <Viewer
          full
          creditContainer={creditHostElement}
          terrainProvider={ellipsoidTerrain}
          baseLayerPicker={false}
          geocoder={false}
          homeButton={false}
          sceneModePicker={false}
          navigationHelpButton={false}
          animation={false}
          timeline={false}
          fullscreenButton={false}
          infoBox={false}
          selectionIndicator={false}
          shouldAnimate={false}
        >
          <ScreenSpaceCameraController
            minimumZoomDistance={1200}
            maximumZoomDistance={2.2e7}
          />
          <ViewerCaptureBridge onViewer={setViewerFromBridge} />
          <GlobeFxStack />
          <InstallImageryLayers baseProvider={esriImagery} overlayProvider={esriLabels} />
          <AtlasGlobeInteractionBridge entities={entities} />

          {entities.map((row) => {
            const bright = colorForOntologyClass(row.class);
            const latestAssertion = [...row.assertions].sort((a, b) =>
              b.generatedAtTime.localeCompare(a.generatedAtTime),
            )[0];
            const outline = reconciliationOutline(latestAssertion?.reconciliationStatus ?? 'confirmed');
            const fill = Color.fromCssColorString(bright).withAlpha(
              selectedId === row.id ? 0.92 : hoveredEntityId === row.id ? 0.85 : 0.72,
            );

            if (row.lat == null || row.lon == null) return null;

            // Snapshot state refs into the callback — Cesium calls these synchronously
            // during render so they always read the latest value.
            const sid = selectedId;
            const hid = hoveredEntityId;
            const yr = currentYear;

            return (
              <Entity
                key={row.id}
                id={row.id}
                position={Cartesian3.fromDegrees(row.lon, row.lat, Math.max(row.height ?? 120, 40))}
                point={{
                  pixelSize: new CallbackProperty(
                    () => ontologyEntityPointPixels(row, sid, hid, yr),
                    false,
                  ),
                  color: fill,
                  outlineColor: outline,
                  outlineWidth:
                    selectedId === row.id ? 2 : hoveredEntityId === row.id ? 1.75 : 1.25,
                  heightReference: HeightReference.NONE,
                  // Keep points visible above terrain meshes
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                  scaleByDistance: new NearFarScalar(4e6, 1.85, 1.85e7, 0.35),
                }}
                label={{
                  text: row.name,
                  font: '600 13px ui-sans-serif,system-ui,sans-serif',
                  fillColor: Color.WHITE.withAlpha(selectedId === row.id ? 0.98 : 0.88),
                  outlineColor: Color.fromCssColorString('#0f172a').withAlpha(0.92),
                  outlineWidth: 3,
                  style: LabelStyle.FILL_AND_OUTLINE,
                  verticalOrigin: VerticalOrigin.BOTTOM,
                  horizontalOrigin: HorizontalOrigin.LEFT,
                  pixelOffset: new Cartesian2(10, -6),
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                  distanceDisplayCondition: new DistanceDisplayCondition(1200, 2.85e7),
                  showBackground: true,
                  backgroundPadding: new Cartesian2(8, 4),
                }}
              />
            );
          })}
        </Viewer>
      : null}
    </>
  );
}
