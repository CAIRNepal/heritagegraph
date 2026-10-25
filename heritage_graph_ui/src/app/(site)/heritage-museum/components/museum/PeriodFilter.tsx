'use client';

import { useAtlasWords } from '@/app/(site)/atlas/components/atlas-words';
import { ERAS, type EraId } from '@/lib/heritage-atlas/atlas-model';
import { cn } from '@/lib/utils';

interface PeriodFilterProps {
  era: EraId | null;
  onEra: (era: EraId | null) => void;
  /** Records per period after search and kind, before this filter. */
  counts: Record<EraId, number>;
}

/**
 * Show one period. It filters every lens, not only the map: the exhibit's
 * Previous/Next, the timeline and the map all walk the same records.
 */
export function PeriodFilter({ era, onEra, counts }: PeriodFilterProps) {
  const { t, eraName, eraSpan } = useAtlasWords();
  return (
    <div role="group" aria-label={t('whenTitle')} className="grid gap-1.5">
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase">{t('whenTitle')}</p>
      <div className="flex flex-wrap gap-1">
        {ERAS.map((e) => {
          const n = counts[e.id];
          const on = era === e.id;
          return (
            <button
              key={e.id}
              type="button"
              aria-pressed={on}
              disabled={n === 0 && !on}
              onClick={() => onEra(on ? null : e.id)}
              title={eraSpan(e.id)}
              className={cn(
                'inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 border px-2 py-0.5 text-xs disabled:cursor-default disabled:opacity-35',
                on ? 'border-story-ink bg-story-ink text-story-paper' : 'border-story-rule hover:bg-story-panel',
              )}
            >
              {eraName(e.id)}
              <span className={cn('tabular-nums', on ? 'opacity-70' : 'text-story-ink-soft')}>{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
