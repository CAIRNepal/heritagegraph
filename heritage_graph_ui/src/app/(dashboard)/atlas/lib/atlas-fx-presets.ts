import {
  Color,
  PostProcessStage,
  PostProcessStageLibrary,
  type Scene,
} from 'cesium';

import {
  ANIME_FRAGMENT_SHADER,
  CRT_FRAGMENT_SHADER,
  FLIR_FRAGMENT_SHADER,
  PIXEL_FRAGMENT_SHADER,
} from './atlas-fx-shaders';

export type AtlasFxPresetId =
  | 'normal'
  | 'crt'
  | 'nvg'
  | 'flir'
  | 'anime'
  | 'noir'
  | 'pixel';

export const ATLAS_FX_PRESET_ORDER: AtlasFxPresetId[] = [
  'normal',
  'crt',
  'nvg',
  'flir',
  'anime',
  'noir',
  'pixel',
];

export interface AtlasFxRuntimeParams {
  sensitivity: number;
  bloom: number;
  pixelation: number;
  flirPolarity: 'whot' | 'bhot';
}

export function cssFilterForPreset(id: AtlasFxPresetId): string {
  switch (id) {
    case 'normal':
    case 'pixel':
      return 'none';
    case 'crt':
      return 'contrast(1.12) saturate(1.08)';
    case 'nvg':
      return 'hue-rotate(72deg) saturate(2.1) brightness(1.08)';
    case 'flir':
      return 'grayscale(1) contrast(1.35)';
    case 'anime':
      return 'saturate(1.35) contrast(1.08)';
    case 'noir':
      return 'grayscale(1) contrast(1.22)';
    default:
      return 'none';
  }
}

/** Presets where the bloom slider affects built-in bloom. */
export function presetAllowsBloomSlider(preset: AtlasFxPresetId): boolean {
  return preset === 'crt' || preset === 'anime' || preset === 'normal';
}

function crtPixelSizeFromSlider(pixelation: number): number {
  const p = Math.max(2, Math.min(96, pixelation));
  return Math.max(1 / 960, p / 72_000);
}

export function buildCustomPostStages(
  preset: AtlasFxPresetId,
  params: AtlasFxRuntimeParams,
): PostProcessStage[] {
  const stages: PostProcessStage[] = [];
  const sens = Math.max(0.35, Math.min(2.4, params.sensitivity));
  const pix = Math.max(4, Math.min(144, params.pixelation));

  switch (preset) {
    case 'crt':
      stages.push(
        new PostProcessStage({
          name: 'atlas-crt',
          fragmentShader: CRT_FRAGMENT_SHADER,
          uniforms: {
            u_strength: sens,
            u_pixelSize: crtPixelSizeFromSlider(pix),
          },
        }),
      );
      break;
    case 'flir':
      stages.push(
        new PostProcessStage({
          name: 'atlas-flir',
          fragmentShader: FLIR_FRAGMENT_SHADER,
          uniforms: {
            u_polarity: params.flirPolarity === 'whot' ? 1.0 : 0.0,
            u_sensitivity: sens,
          },
        }),
      );
      break;
    case 'anime':
      stages.push(
        new PostProcessStage({
          name: 'atlas-anime',
          fragmentShader: ANIME_FRAGMENT_SHADER,
          uniforms: {
            u_edge: sens,
          },
        }),
      );
      break;
    case 'pixel':
      stages.push(
        new PostProcessStage({
          name: 'atlas-pixel',
          fragmentShader: PIXEL_FRAGMENT_SHADER,
          uniforms: {
            u_cells: pix,
            u_aspect: 1.6,
          },
        }),
      );
      break;
    case 'nvg': {
      stages.push(PostProcessStageLibrary.createNightVisionStage());
      const bright = PostProcessStageLibrary.createBrightnessStage();
      bright.uniforms.brightness = sens * 0.35;
      stages.push(bright);
      break;
    }
    case 'noir': {
      stages.push(PostProcessStageLibrary.createBlackAndWhiteStage());
      const bright = PostProcessStageLibrary.createBrightnessStage();
      bright.uniforms.brightness = (sens - 1) * 0.22;
      stages.push(bright);
      break;
    }
    default:
      break;
  }

  return stages;
}

/** Tune globe + sky for thermal / NVG readability. */
export function applyGlobeEnvironmentForPreset(scene: Scene | undefined, preset: AtlasFxPresetId): void {
  if (!scene?.globe) return;
  const globe = scene.globe;
  const sky = scene.skyAtmosphere;

  switch (preset) {
    case 'nvg':
      globe.baseColor = Color.fromCssColorString('#03140a');
      globe.showGroundAtmosphere = false;
      globe.enableLighting = false;
      if (sky) sky.show = false;
      break;
    case 'flir':
      globe.baseColor = Color.BLACK;
      globe.showGroundAtmosphere = false;
      globe.enableLighting = false;
      if (sky) sky.show = false;
      break;
    default:
      globe.baseColor = Color.fromCssColorString('#0b172a');
      globe.showGroundAtmosphere = true;
      globe.enableLighting = true;
      if (sky) sky.show = true;
      break;
  }
  scene.requestRender?.();
}
