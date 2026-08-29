'use client';

import { cn } from '@/lib/utils';
import type { AtlasEra } from '@/types/atlas';

import { ATLAS_ERAS_ORDER, useAtlasStore } from '../../hooks/use-atlas-store';

/** Historical era boundaries (years CE) used to segment the timeline. */
export const ERA_BOUNDS: Record<AtlasEra, { start: number; end: number; short: string }> = {
  ancient: { start: -800, end: 879, short: 'Ancient' },
  medieval: { start: 879, end: 1769, short: 'Malla' },
  early_modern: { start: 1769, end: 1951, short: 'Shah' },
  modern: { start: 1951, end: 2100, short: 'Modern' },
};

export function eraForYear(year: number): AtlasEra {
  for (const era of ATLAS_ERAS_ORDER) {
    if (year < ERA_BOUNDS[era].end) return era;
  }
  return 'modern';
}

/** Era jump chips: clicking flies the timeline to the middle of that era. */
export function EraSelector() {
  const currentYear = useAtlasStore((s) => s.currentYear);
  const minYear = useAtlasStore((s) => s.minYear);
  const maxYear = useAtlasStore((s) => s.maxYear);
  const setCurrentYear = useAtlasStore((s) => s.setCurrentYear);

  const activeEra = eraForYear(currentYear);

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Jump to era">
      {ATLAS_ERAS_ORDER.map((era) => {
        const bounds = ERA_BOUNDS[era];
        const lo = Math.max(bounds.start, minYear);
        const hi = Math.min(bounds.end, maxYear);
        if (lo >= hi) return null;
        const active = activeEra === era;
        return (
          <button
            key={era}
            type="button"
            aria-pressed={active}
            onClick={() => setCurrentYear(Math.round((lo + hi) / 2))}
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide transition-colors',
              active
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground/60 hover:bg-muted/50 hover:text-foreground',
            )}
          >
            {bounds.short}
          </button>
        );
      })}
    </div>
  );
}
