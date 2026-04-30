'use client';

import type { PostProcessStage, Viewer as CesiumViewerType } from 'cesium';
import { useEffect, useRef } from 'react';
import { useCesium } from 'resium';

import {
  applyGlobeEnvironmentForPreset,
  buildCustomPostStages,
  presetAllowsBloomSlider,
  type AtlasFxRuntimeParams,
} from '../lib/atlas-fx-presets';
import { useAtlasStore } from '../hooks/use-atlas-store';

export function GlobeFxStack() {
  const { viewer } = useCesium();
  const preset = useAtlasStore((s) => s.fxPreset);
  const sensitivity = useAtlasStore((s) => s.fxSensitivity);
  const bloom = useAtlasStore((s) => s.fxBloom);
  const pixelation = useAtlasStore((s) => s.fxPixelation);
  const flirPolarity = useAtlasStore((s) => s.fxFlirPolarity);
  const eco = useAtlasStore((s) => s.fxEcoQuality);

  const addedRef = useRef<PostProcessStage[]>([]);

  useEffect(() => {
    const v = viewer as CesiumViewerType | undefined;
    if (!v) return;
    const scale = eco ? 0.85 : 1;
    v.resolutionScale = scale;
    v.scene?.requestRender?.();
  }, [viewer, eco]);

  useEffect(() => {
    const v = viewer as CesiumViewerType | undefined;
    const scene = v?.scene;
    if (!v || !scene) return;

    const coll = scene.postProcessStages;
    for (const s of addedRef.current) {
      coll.remove(s);
    }
    addedRef.current = [];

    applyGlobeEnvironmentForPreset(scene, preset);

    const params: AtlasFxRuntimeParams = {
      sensitivity,
      bloom,
      pixelation,
      flirPolarity,
    };

    const built = buildCustomPostStages(preset, params);
    for (const st of built) {
      coll.add(st);
      addedRef.current.push(st);
    }

    const bloomStage = coll.bloom;
    const allowBloom = presetAllowsBloomSlider(preset) && bloom > 0.02;
    bloomStage.enabled = allowBloom;
    if (allowBloom && bloomStage.uniforms) {
      bloomStage.uniforms.contrast = 105 + bloom * 100;
      bloomStage.uniforms.brightness = -0.38 + bloom * 0.52;
    } else {
      bloomStage.enabled = false;
    }

    scene.requestRender?.();

    return () => {
      for (const s of addedRef.current) {
        coll.remove(s);
      }
      addedRef.current = [];
      bloomStage.enabled = false;
      scene.requestRender?.();
    };
  }, [viewer, preset, sensitivity, bloom, pixelation, flirPolarity]);

  return null;
}
