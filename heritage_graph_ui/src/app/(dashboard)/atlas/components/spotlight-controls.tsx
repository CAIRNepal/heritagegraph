'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { atlasSound } from '@/lib/atlas-sound';

import {
  ATLAS_SPOTLIGHT_SCALE_MAX,
  ATLAS_SPOTLIGHT_SCALE_MIN,
  useAtlasStore,
} from '../hooks/use-atlas-store';

const PRESET_VALUES = [0.72, 0.88, 1] as const;

interface SpotlightControlsProps {
  variant?: 'popover' | 'dock';
  className?: string;
}

export function SpotlightControls({ variant = 'popover', className }: SpotlightControlsProps) {
  const t = useTranslations('Atlas');
  const discTransparent = useAtlasStore((s) => s.discTransparent);
  const spotlightScale = useAtlasStore((s) => s.spotlightScale);
  const setDiscTransparent = useAtlasStore((s) => s.setDiscTransparent);
  const setSpotlightScale = useAtlasStore((s) => s.setSpotlightScale);

  const pct = Math.round(spotlightScale * 100);

  return (
    <div
      className={cn(
        'flex flex-col gap-3',
        variant === 'dock' ? 'min-h-0 flex-1 p-2' : 'w-full max-w-[min(22rem,92vw)]',
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-[11px] font-semibold tracking-tight">{t('spotlightTitle')}</p>
        <p className="text-[10px] leading-snug text-muted-foreground">{t('spotlightDescription')}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="atlas-spotlight-transparent" className="text-[11px] font-normal">
          {t('spotlightTransparentLabel')}
        </Label>
        <Switch
          id="atlas-spotlight-transparent"
          checked={discTransparent}
          onCheckedChange={(v) => setDiscTransparent(v)}
          aria-label={t('spotlightTransparentLabel')}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="atlas-spotlight-size" className="text-[11px] font-normal">
            {t('spotlightSizeLabel')}
          </Label>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <Slider
          id="atlas-spotlight-size"
          min={ATLAS_SPOTLIGHT_SCALE_MIN}
          max={ATLAS_SPOTLIGHT_SCALE_MAX}
          step={0.01}
          value={[spotlightScale]}
          onValueChange={(v) => {
            const n = v[0];
            if (n != null) setSpotlightScale(n, { withSound: false });
          }}
          onValueCommit={() => {
            atlasSound.play('click');
          }}
          aria-label={t('spotlightSizeLabel')}
        />
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-medium text-muted-foreground">{t('spotlightPresets')}</span>
        <div className="flex flex-wrap gap-1">
          {PRESET_VALUES.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setSpotlightScale(val)}
              className={cn(
                'rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wide',
                Math.abs(spotlightScale - val) < 0.02 ?
                  'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70',
              )}
            >
              {val === PRESET_VALUES[0] ?
                t('spotlightPresetCompact')
              : val === PRESET_VALUES[1] ?
                t('spotlightPresetBalanced')
              : t('spotlightPresetImmersive')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[11px]"
          onClick={() => setSpotlightScale(1)}
        >
          {t('spotlightResetSize')}
        </Button>
        <p className="text-[10px] leading-snug text-muted-foreground">
          {t('spotlightShortcutHint')}
        </p>
      </div>
    </div>
  );
}
