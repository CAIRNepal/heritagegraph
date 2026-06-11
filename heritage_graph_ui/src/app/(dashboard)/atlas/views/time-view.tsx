'use client';

import { useTranslations } from 'next-intl';

import type { AtlasEntity } from '@/types/atlas';

import { cn } from '@/lib/utils';

import { useAtlasStore, useFilteredAtlasEntities } from '../hooks/use-atlas-store';

function deterministicSpan(entity: AtlasEntity, cursorYear: number): number {
  let seed = 0;
  for (let i = 0; i < entity.id.length; i += 1) seed += entity.id.charCodeAt(i);
  const jitter = (seed % 37) / 37;
  const baseEnd =
    entity.lastKnownExistenceYear ??
    Math.max(...entity.events.map((e) => e.year), cursorYear);
  const forward = Math.min(85, 18 + jitter * 40 + entity.class.length * 3);
  return Math.round(baseEnd + forward);
}

interface TimeViewProps {
  compact?: boolean;
}

export function TimeView({ compact = false }: TimeViewProps) {
  const t = useTranslations('Atlas');

  const rows = useFilteredAtlasEntities();
  const currentYear = useAtlasStore((s) => s.currentYear);
  const minYear = useAtlasStore((s) => s.minYear);
  const maxYear = useAtlasStore((s) => s.maxYear);
  const dataSource = useAtlasStore((s) => s.dataSource);

  // Projected continuation bands are demo-corpus storytelling; live KG rows
  // only show documented spans.
  const showPredictive = dataSource === 'demo';
  const span = maxYear - minYear || 1;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2',
        compact ? 'h-full px-1 pb-1' : 'px-2 pb-2 md:pl-16 md:pr-2 md:pt-14',
      )}
    >
      {showPredictive ?
        <p
          className={cn(
            'rounded-lg border border-dashed border-border/70 bg-muted/30 px-3 py-2 font-mono text-muted-foreground leading-snug',
            compact ? 'text-[9px]' : 'text-[10px]',
          )}
        >
          {t('timePredictiveDisclaimer')}
        </p>
      : null}

      <div
        className={cn(
          'min-h-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-background/70 backdrop-blur-md',
          compact ? 'p-2' : 'p-3',
        )}
      >
        <div className="relative space-y-4 pb-8 pt-2">
          <div
            className="pointer-events-none absolute bottom-0 top-0 w-px bg-primary/80"
            style={{
              left: `${((currentYear - minYear) / span) * 100}%`,
            }}
          />

          {rows.map((e) => {
            const start = e.foundedYear ?? minYear;
            const endHist =
              e.lastKnownExistenceYear ??
              Math.max(...e.events.map((ev) => ev.year), start);
            const predEnd = deterministicSpan(e, currentYear);
            const leftPct = ((start - minYear) / span) * 100;
            const widthHist = Math.max(2, ((Math.min(endHist, maxYear) - start) / span) * 100);
            const predLeft = ((Math.min(endHist, maxYear) - minYear) / span) * 100;
            const predWidth = Math.max(2, ((predEnd - Math.min(endHist, maxYear)) / span) * 100);

            return (
                <div
                  key={e.id}
                  className={cn(
                    'relative grid gap-2 text-[11px]',
                    compact ? 'grid-cols-[minmax(0,5rem)_1fr]' : 'grid-cols-[minmax(0,9rem)_1fr]',
                  )}
                >
                <div className="truncate pt-1 font-medium">{e.name}</div>
                <div className="relative h-10 rounded-md bg-muted/40">
                  <span
                    className="absolute top-1 z-[1] h-7 rounded border border-border bg-chart-2/80"
                    style={{ left: `${leftPct}%`, width: `${widthHist}%` }}
                    title={`${start}–${endHist}`}
                  />
                  {showPredictive ?
                    <span
                      className="absolute top-1 z-0 h-7 rounded border border-dashed border-chart-4/70 bg-chart-4/15"
                      style={{
                        left: `${predLeft}%`,
                        width: `${predWidth}%`,
                      }}
                      title={t('predictiveBand')}
                    />
                  : null}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between px-1 font-mono text-[9px] text-muted-foreground">
                    <span>{e.class}</span>
                    <span>{currentYear <= endHist ? '●' : '○'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
