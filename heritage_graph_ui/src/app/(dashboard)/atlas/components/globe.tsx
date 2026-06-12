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
import { Entity, ImageryLayer, ScreenSpaceCameraController, Viewer, useCesium } from 'resium';
import { useShallow } from 'zustand/react/shallow';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';
import { colorForOntologyClass } from '@/lib/atlas-globe-colors';
import { MAP_DEFAULT, GLOBE_DEFAULT_HEIGHT } from '@/lib/map-config';
import { atlasPrefersReducedMotion } from '@/lib/atlas-motion';
import { temporalGlobeAlpha } from '@/lib/atlas-temporal';
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
Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_ACCESS_TOKEN ?? '';

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
  const temporalFilterEnabled = useAtlasStore((s) => s.temporalFilterEnabled);
  const fxEcoQuality = useAtlasStore((s) => s.fxEcoQuality);

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
      const duration = atlasPrefersReducedMotion() ? 0 : flightDuration(distKm);
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
        void v.flyTo(entity, { duration: atlasPrefersReducedMotion() ? 0 : 1.45 });
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
      Cartesian3.fromDegrees(MAP_DEFAULT.lon, MAP_DEFAULT.lat, GLOBE_DEFAULT_HEIGHT),
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
    const v = viewerRef.current;
    if (!v?.scene) return;
    const scene = v.scene;
    if (fxEcoQuality) {
      scene.requestRenderMode = true;
      scene.maximumRenderTimeChange = Infinity;
      v.targetFrameRate = 30;
    } else {
      scene.requestRenderMode = false;
      scene.maximumRenderTimeChange = 0;
    }
    scene.requestRender();
  }, [viewerReady, fxEcoQuality]);

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

  const coordProvenanceOutline = (provenance?: string): Color => {
    switch (provenance) {
      case 'verified':
        return Color.fromCssColorString('#16a34a').withAlpha(0.95);
      case 'gazetteer':
        return Color.fromCssColorString('#d97706').withAlpha(0.92);
      case 'inherited':
        return Color.fromCssColorString('#0284c7').withAlpha(0.9);
      default:
        return Color.fromCssColorString('#94a3b8').withAlpha(0.85);
    }
  };

  return (
    <>
      <div
        ref={setCreditHostElement}
        className="pointer-events-auto absolute bottom-2 right-2 z-30 max-w-[min(70%,520px)] rounded-md border border-border/50 bg-background/75 px-2 py-1 text-[10px] leading-snug text-muted-foreground backdrop-blur-md"
      />
      {creditHostElement ?
        <Viewer
          full
          creditContainer={creditHostElement}
          terrainProvider={ellipsoidTerrain}
          // Skip Cesium's default Ion/Bing base imagery (we have no Ion token and
          // supply our own Esri tiles in InstallImageryLayers). Without this,
          // Cesium 1.140 tries to load Ion world imagery, fails on the empty
          // token, and the globe renders blank/broken.
          baseLayer={false}
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
          {/* Declarative imagery (robust across Cesium versions): Esri satellite
              base + a faint boundaries/places reference overlay. Replaces the
              imperative addImageryProvider effect, which depended on useCesium()
              timing and silently left the globe blank. */}
          <ImageryLayer imageryProvider={esriImagery} />
          <ImageryLayer imageryProvider={esriLabels} alpha={0.42} />
          <AtlasGlobeInteractionBridge entities={entities} />

          {entities.map((row) => {
            const bright = colorForOntologyClass(row.class);
            const latestAssertion = [...row.assertions].sort((a, b) =>
              b.generatedAtTime.localeCompare(a.generatedAtTime),
            )[0];
            const reconStatus = latestAssertion?.reconciliationStatus ?? 'confirmed';
            const outline =
              row.coordProvenance ?
                coordProvenanceOutline(row.coordProvenance)
              : reconciliationOutline(reconStatus);
            const outlineWidth =
              reconStatus === 'conflicting' ? 2.5
              : row.coordProvenance === 'gazetteer' ? 2.25
              : selectedId === row.id ? 2
              : hoveredEntityId === row.id ? 1.75
              : 1.25;
            const sid = selectedId;
            const hid = hoveredEntityId;
            const yr = currentYear;
            const temporalAlpha = temporalFilterEnabled ? temporalGlobeAlpha(row, yr) : 1;
            if (temporalAlpha <= 0.02) return null;

            const baseAlpha =
              selectedId === row.id ? 0.92 : hoveredEntityId === row.id ? 0.85 : 0.72;
            const fill = Color.fromCssColorString(bright).withAlpha(baseAlpha * temporalAlpha);

            if (row.lat == null || row.lon == null) return null;

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
                  outlineWidth,
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
                  show:
                    temporalFilterEnabled && temporalAlpha < 0.45
                      ? selectedId === row.id || hoveredEntityId === row.id
                      : true,
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
