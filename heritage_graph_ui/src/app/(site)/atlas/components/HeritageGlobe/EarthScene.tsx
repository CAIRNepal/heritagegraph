'use client';

/* Side-effect MUST run before Cesium resolves worker URLs (see public/cesium). */
import '@/app/(site)/atlas/cesium-base-url';

import type { ReactNode, RefObject } from 'react';
import { useEffect, useMemo, useState } from 'react';

import {
  Color,
  EllipsoidTerrainProvider,
  Ion,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  type Viewer as CesiumViewerType,
} from 'cesium';
import { ImageryLayer, ScreenSpaceCameraController, Viewer, useCesium } from 'resium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

import type { AtlasGlobeHandles } from '@/app/(site)/atlas/globe-handles';
import type { AtlasEntity } from '@/types/atlas';

import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import {
  BOUNDARIES_LAYER,
  NIGHT_LIGHTS_LAYER,
  getImageryLayerDef,
} from '../../lib/atlas-layers';
import { CameraController } from './CameraController';
import { ConnectionArcs } from './ConnectionArcs';
import { HeritageMarkers } from './HeritageMarkers';
import { StarField } from './StarField';

// Suppress Ion service requests — all imagery comes from keyless public tiles.
Ion.defaultAccessToken = process.env.NEXT_PUBLIC_CESIUM_ION_ACCESS_TOKEN ?? '';

const ellipsoidTerrain = new EllipsoidTerrainProvider();

// Stable reference: resium recreates the whole Viewer when read-only props like
// `contextOptions` change identity, which tears down the WebGL context mid-flight.
const WEBGL_CONTEXT_OPTIONS = { webgl: { alpha: true } };

/** Configures the scene for the cinematic look: transparent canvas over a CSS
 *  star field, sky atmosphere, sun-driven day/night lighting, ground glow. */
function SceneAtmosphere() {
  const { viewer } = useCesium();

  useEffect(() => {
    const v = viewer as CesiumViewerType | undefined;
    if (!v || v.isDestroyed()) return;
    const scene = v.scene;

    scene.backgroundColor = Color.TRANSPARENT;
    // `show` exists at runtime but is missing from Cesium's SkyBox typings.
    if (scene.skyBox) (scene.skyBox as unknown as { show: boolean }).show = false;
    if (scene.moon) scene.moon.show = false;
    if (scene.sun) scene.sun.show = true;
    if (scene.skyAtmosphere) {
      scene.skyAtmosphere.show = true;
      scene.skyAtmosphere.brightnessShift = 0.12;
      scene.skyAtmosphere.saturationShift = 0.05;
    }

    scene.globe.enableLighting = true;
    scene.globe.dynamicAtmosphereLighting = true;
    scene.globe.showGroundAtmosphere = true;
    scene.globe.atmosphereBrightnessShift = 0.08;
    scene.globe.baseColor = Color.fromCssColorString('#0a1424');

    scene.postProcessStages.fxaa.enabled = true;
    scene.highDynamicRange = true;

    // Double-click is reserved for the cinematic "fly here" gesture.
    v.cesiumWidget.screenSpaceEventHandler.removeInputAction(
      ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
    );
  }, [viewer]);

  return null;
}

interface EarthSceneProps {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
  /** Entities related to the current selection (knowledge-graph context). */
  relatedIds: ReadonlySet<string>;
  entities: AtlasEntity[];
  children?: ReactNode;
}

/**
 * Full-screen realistic Earth: space backdrop with particle stars, day/night
 * terminator with NASA city lights, atmosphere rim glow, and glowing clustered
 * heritage markers. All camera work lives in {@link CameraController}.
 */
export function EarthScene({ globeHandlesRef, relatedIds, entities, children }: EarthSceneProps) {
  const imageryLayer = useAtlasUiStore((s) => s.imageryLayer);
  const nightLights = useAtlasUiStore((s) => s.nightLights);
  const boundaries = useAtlasUiStore((s) => s.boundaries);

  const [creditHost, setCreditHost] = useState<HTMLElement | null>(null);

  const baseProvider = useMemo(() => {
    const def = getImageryLayerDef(imageryLayer);
    return new UrlTemplateImageryProvider({
      url: def.url,
      credit: def.credit,
      maximumLevel: def.maximumLevel,
    });
  }, [imageryLayer]);

  const nightProvider = useMemo(
    () =>
      new UrlTemplateImageryProvider({
        url: NIGHT_LIGHTS_LAYER.url,
        credit: NIGHT_LIGHTS_LAYER.credit,
        maximumLevel: NIGHT_LIGHTS_LAYER.maximumLevel,
      }),
    [],
  );

  const boundariesProvider = useMemo(
    () =>
      new UrlTemplateImageryProvider({
        url: BOUNDARIES_LAYER.url,
        credit: BOUNDARIES_LAYER.credit,
        maximumLevel: BOUNDARIES_LAYER.maximumLevel,
      }),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_120%_at_50%_-10%,#101a33_0%,#070b16_45%,#02040a_100%)]">
      <StarField />
      {/* Subtle nebula tint for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            'radial-gradient(45% 40% at 18% 24%, rgba(64,115,181,0.14), transparent 70%), radial-gradient(38% 34% at 82% 70%, rgba(147,102,235,0.10), transparent 70%)',
        }}
      />

      <div
        ref={setCreditHost}
        className="pointer-events-auto absolute bottom-1.5 left-1/2 z-20 max-w-[min(72%,560px)] -translate-x-1/2 truncate rounded-full bg-black/30 px-3 py-0.5 text-[9px] leading-tight text-white/45 backdrop-blur-sm [&_a]:text-white/60"
      />

      {creditHost ? (
        <Viewer
          full
          creditContainer={creditHost}
          terrainProvider={ellipsoidTerrain}
          // No Ion token: skip default Bing/Ion base imagery entirely.
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
          shouldAnimate
          contextOptions={WEBGL_CONTEXT_OPTIONS}
        >
          <SceneAtmosphere />
          <ScreenSpaceCameraController
            minimumZoomDistance={900}
            maximumZoomDistance={3.4e7}
            enableTilt
            inertiaSpin={0.95}
            inertiaZoom={0.92}
            inertiaTranslate={0.95}
          />

          <ImageryLayer imageryProvider={baseProvider} />
          <ImageryLayer
            imageryProvider={nightProvider}
            dayAlpha={0}
            nightAlpha={0.95}
            show={nightLights}
          />
          <ImageryLayer imageryProvider={boundariesProvider} alpha={0.35} show={boundaries} />

          <CameraController globeHandlesRef={globeHandlesRef} entities={entities} />
          <HeritageMarkers entities={entities} relatedIds={relatedIds} />
          <ConnectionArcs entities={entities} relatedIds={relatedIds} />
          {children}
        </Viewer>
      ) : null}
    </div>
  );
}
