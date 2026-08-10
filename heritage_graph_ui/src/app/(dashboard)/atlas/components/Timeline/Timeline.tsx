'use client';

import { useTranslations } from 'next-intl';
import { Pause, Play } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useAtlasStore, useFilteredAtlasEntities, ATLAS_ERAS_ORDER } from '../../hooks/use-atlas-store';
import { ATLAS_GLASS, formatYear } from '../../lib/atlas-format';
import { ERA_BOUNDS } from './EraSelector';
import { EraSelector } from './EraSelector';

const BUCKETS = 72;

const ERA_TINTS: Record<string, string> = {
  ancient: 'rgba(251,191,36,0.10)',
  medieval: 'rgba(244,114,182,0.10)',
  early_modern: 'rgba(56,189,248,0.10)',
  modern: 'rgba(52,211,153,0.10)',
};

/**
 * Cinematic bottom timeline: era bands, a density histogram of foundings,
 * drag/scroll scrubbing and playback. Scrubbing time-travels the globe —
 * markers fade in and out as heritage appears through the centuries.
 */
export function Timeline() {
  const t = useTranslations('Atlas');
  const entities = useFilteredAtlasEntities();
  const allEntities = useAtlasStore((s) => s.entities);
  const currentYear = useAtlasStore((s) => s.currentYear);
  const minYear = useAtlasStore((s) => s.minYear);
  const maxYear = useAtlasStore((s) => s.maxYear);
  const setCurrentYear = useAtlasStore((s) => s.setCurrentYear);
  const playing = useAtlasStore((s) => s.playing);
  const togglePlaying = useAtlasStore((s) => s.togglePlaying);

  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const span = Math.max(1, maxYear - minYear);
  const progress = (currentYear - minYear) / span;

  const histogram = useMemo(() => {
    const buckets = new Array<number>(BUCKETS).fill(0);
    for (const e of allEntities) {
      if (e.foundedYear == null) continue;
      const t = (e.foundedYear - minYear) / span;
      if (t < 0 || t > 1) continue;
      buckets[Math.min(BUCKETS - 1, Math.floor(t * BUCKETS))] += 1;
    }
    const max = Math.max(1, ...buckets);
    return buckets.map((b) => b / max);
  }, [allEntities, minYear, span]);

  const eraBands = useMemo(
    () =>
      ATLAS_ERAS_ORDER.map((era) => {
        const b = ERA_BOUNDS[era];
        const lo = Math.max(b.start, minYear);
        const hi = Math.min(b.end, maxYear);
        if (lo >= hi) return null;
        return {
          era,
          left: ((lo - minYear) / span) * 100,
          width: ((hi - lo) / span) * 100,
        };
      }).filter((x): x is NonNullable<typeof x> => x != null),
    [minYear, maxYear, span],
  );

  const yearFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(minYear + t * span);
    },
    [minYear, span],
  );

  return (
    <section
      aria-label={t('timeline.title')}
      className={cn(
        ATLAS_GLASS,
        'pointer-events-auto absolute inset-x-4 bottom-4 z-30 flex h-20 items-center gap-3 px-3 md:inset-x-6',
      )}
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={playing ? 'Pause time travel' : 'Play time travel'}
        className={cn(
          'h-10 w-10 shrink-0 rounded-2xl',
          playing ? 'bg-primary/20 text-primary' : 'bg-muted/50',
        )}
        onClick={togglePlaying}
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" strokeWidth={1.5} />
        ) : (
          <Play className="h-4 w-4 fill-current" strokeWidth={1.5} />
        )}
      </Button>

      <div className="flex w-20 shrink-0 flex-col items-start">
        <span className="font-mono text-lg font-semibold leading-none tabular-nums tracking-tight">
          {currentYear <= 0 ? 1 - currentYear : currentYear}
        </span>
        <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70">
          {currentYear <= 0 ? 'BCE' : 'CE'} · {entities.length.toLocaleString()} visible
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="hidden items-center justify-between sm:flex">
          <EraSelector />
          <span className="font-mono text-[9px] tabular-nums text-muted-foreground/50">
            {formatYear(minYear)} — {formatYear(maxYear)}
          </span>
        </div>

        {/* Scrub track */}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={t('timeline.year')}
          aria-valuemin={minYear}
          aria-valuemax={maxYear}
          aria-valuenow={currentYear}
          aria-valuetext={formatYear(currentYear)}
          className="relative h-9 w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-xl"
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            const y = yearFromPointer(e.clientX);
            if (y != null) setCurrentYear(y);
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current) return;
            const y = yearFromPointer(e.clientX);
            if (y != null) setCurrentYear(y);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onWheel={(e) => {
            const step = Math.max(1, Math.round(span / 300));
            setCurrentYear(currentYear + (e.deltaY > 0 ? step : -step));
          }}
          onKeyDown={(e) => {
            const step = Math.max(1, Math.round(span / 200));
            if (e.key === 'ArrowRight') setCurrentYear(currentYear + step);
            if (e.key === 'ArrowLeft') setCurrentYear(currentYear - step);
            if (e.key === 'Home') setCurrentYear(minYear);
            if (e.key === 'End') setCurrentYear(maxYear);
          }}
        >
          {/* Era tint bands */}
          {eraBands.map((band) => (
            <div
              key={band.era}
              className="absolute inset-y-0"
              style={{
                left: `${band.left}%`,
                width: `${band.width}%`,
                background: ERA_TINTS[band.era],
              }}
            />
          ))}

          {/* Density histogram */}
          <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-px px-px">
            {histogram.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-[1px] bg-foreground/25"
                style={{ height: `${Math.max(4, h * 88)}%`, opacity: 0.35 + h * 0.65 }}
              />
            ))}
          </div>

          {/* Elapsed veil */}
          <div
            className="absolute inset-y-0 left-0 bg-primary/10"
            style={{ width: `${progress * 100}%` }}
          />

          {/* Playhead */}
          <div
            className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-primary shadow-[0_0_10px] shadow-primary/70"
            style={{ left: `${progress * 100}%` }}
          >
            <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/80" />
          </div>
        </div>
      </div>
    </section>
  );
}
