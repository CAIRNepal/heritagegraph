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
      <p className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">{t('whenTitle')}</p>
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
                'inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-default disabled:opacity-40',
                on ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:border-muted-foreground',
              )}
            >
              {eraName(e.id)}
              <span className={cn('tabular-nums', on ? 'opacity-70' : 'text-muted-foreground')}>{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
