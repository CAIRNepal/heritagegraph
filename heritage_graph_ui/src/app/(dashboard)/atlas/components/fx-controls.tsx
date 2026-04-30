'use client';

import { useTranslations } from 'next-intl';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

import type { AtlasFxPresetId } from '../lib/atlas-fx-presets';
import {
  ATLAS_FX_PRESET_ORDER,
  presetAllowsBloomSlider,
} from '../lib/atlas-fx-presets';
import { useAtlasStore } from '../hooks/use-atlas-store';

const PRESET_IDS: AtlasFxPresetId[] = ATLAS_FX_PRESET_ORDER;

const PRESET_LABEL_KEYS: Record<AtlasFxPresetId, string> = {
  normal: 'fxNormal',
  crt: 'fxCRT',
  nvg: 'fxNVG',
  flir: 'fxFLIR',
  anime: 'fxAnime',
  noir: 'fxNoir',
  pixel: 'fxPixel',
};

interface FxControlsProps {
  variant?: 'dock' | 'popover';
  className?: string;
}

export function FxControls({ variant = 'dock', className }: FxControlsProps) {
  const t = useTranslations('Atlas');
  const preset = useAtlasStore((s) => s.fxPreset);
  const sensitivity = useAtlasStore((s) => s.fxSensitivity);
  const bloom = useAtlasStore((s) => s.fxBloom);
  const pixelation = useAtlasStore((s) => s.fxPixelation);
  const flirPolarity = useAtlasStore((s) => s.fxFlirPolarity);
  const eco = useAtlasStore((s) => s.fxEcoQuality);
  const setFxPreset = useAtlasStore((s) => s.setFxPreset);
  const setFxSensitivity = useAtlasStore((s) => s.setFxSensitivity);
  const setFxBloom = useAtlasStore((s) => s.setFxBloom);
  const setFxPixelation = useAtlasStore((s) => s.setFxPixelation);
  const toggleFlirPolarity = useAtlasStore((s) => s.toggleFlirPolarity);
  const setFxEcoQuality = useAtlasStore((s) => s.setFxEcoQuality);

  const bloomAllowed = presetAllowsBloomSlider(preset);

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        variant === 'dock' ? 'min-h-0 flex-1 p-2' : 'w-full max-w-[min(22rem,92vw)]',
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-semibold tracking-tight">{t('fxTitle')}</p>
        <div className="flex flex-wrap gap-1">
          {PRESET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFxPreset(id)}
              className={cn(
                'rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wide',
                preset === id ?
                  'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70',
              )}
            >
              {t(PRESET_LABEL_KEYS[id])}
            </button>
          ))}
        </div>
      </div>

      {preset === 'flir' ?
        <div className="flex flex-wrap items-center gap-2">
          <Label className="font-mono text-[10px] uppercase">{t('fxPolarity')}</Label>
          <div className="flex gap-1">
            <button
              type="button"
              className={cn(
                'rounded border px-2 py-0.5 font-mono text-[10px]',
                flirPolarity === 'whot' ?
                  'border-primary bg-primary/15 text-foreground'
                : 'border-border/50 text-muted-foreground',
              )}
              onClick={() => flirPolarity !== 'whot' && toggleFlirPolarity()}
            >
              {t('fxWHOT')}
            </button>
            <button
              type="button"
              className={cn(
                'rounded border px-2 py-0.5 font-mono text-[10px]',
                flirPolarity === 'bhot' ?
                  'border-primary bg-primary/15 text-foreground'
                : 'border-border/50 text-muted-foreground',
              )}
              onClick={() => flirPolarity !== 'bhot' && toggleFlirPolarity()}
            >
              {t('fxBHOT')}
            </button>
          </div>
        </div>
      : null}

      <div className="space-y-1">
        <div className="flex justify-between font-mono text-[10px] uppercase text-muted-foreground">
          <Label>{t('fxSensitivity')}</Label>
          <span className="tabular-nums">{sensitivity.toFixed(2)}</span>
        </div>
        <Slider
          min={0.35}
          max={2.4}
          step={0.05}
          value={[sensitivity]}
          onValueChange={(v) => setFxSensitivity(Array.isArray(v) ? (v[0] ?? 1) : v)}
          aria-label={t('fxSensitivity')}
        />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between font-mono text-[10px] uppercase text-muted-foreground">
          <Label>{t('fxPixelation')}</Label>
          <span className="tabular-nums">{Math.round(pixelation)}</span>
        </div>
        <Slider
          min={4}
          max={128}
          step={1}
          value={[pixelation]}
          onValueChange={(v) => setFxPixelation(Array.isArray(v) ? (v[0] ?? 16) : v)}
          aria-label={t('fxPixelation')}
        />
      </div>

      <div className={cn('space-y-1', !bloomAllowed && 'pointer-events-none opacity-40')}>
        <div className="flex justify-between font-mono text-[10px] uppercase text-muted-foreground">
          <Label>{t('fxBloom')}</Label>
          <span className="tabular-nums">{bloom.toFixed(2)}</span>
        </div>
        <Slider
          min={0}
          max={1}
          step={0.02}
          value={[bloom]}
          onValueChange={(v) => setFxBloom(Array.isArray(v) ? (v[0] ?? 0) : v)}
          aria-label={t('fxBloom')}
          disabled={!bloomAllowed}
        />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
        <Label className="font-mono text-[10px] uppercase text-muted-foreground">{t('fxEcoQuality')}</Label>
        <button
          type="button"
          onClick={() => setFxEcoQuality(!eco)}
          className={cn(
            'rounded-md border px-2 py-1 font-mono text-[10px]',
            eco ? 'border-primary bg-primary/10' : 'border-border/60',
          )}
        >
          {eco ? t('fxEcoOn') : t('fxEcoOff')}
        </button>
      </div>
    </div>
  );
}
