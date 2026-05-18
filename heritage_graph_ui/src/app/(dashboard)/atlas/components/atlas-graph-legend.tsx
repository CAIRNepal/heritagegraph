'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { colorForOntologyClass } from '@/lib/atlas-globe-colors';
import { cn } from '@/lib/utils';
import type { OntologyClass } from '@/types/atlas';
import { ONTOLOGY_CLASSES } from '@/types/atlas';

interface AtlasGraphLegendProps {
  classCounts: Partial<Record<OntologyClass, number>>;
  className?: string;
}

export function AtlasGraphLegend({ classCounts, className }: AtlasGraphLegendProps) {
  const t = useTranslations('Atlas');
  const [open, setOpen] = useState(false);

  const entries = useMemo(() => {
    return ONTOLOGY_CLASSES.filter((cls) => (classCounts[cls] ?? 0) > 0).map((cls) => ({
      cls,
      count: classCounts[cls] ?? 0,
      color: colorForOntologyClass(cls),
    }));
  }, [classCounts]);

  if (entries.length === 0) return null;

  return (
    <div className={cn('pointer-events-auto absolute bottom-2 left-2 z-20', className)}>
      {open ?
        <div className="max-h-[min(50vh,280px)] w-56 overflow-y-auto rounded-xl border border-border/70 bg-background/95 p-2 shadow-lg backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-border/50 pb-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('graphLegendTitle')}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              aria-label={t('graphLegendHide')}
            >
              ✕
            </button>
          </div>
          <ul className="space-y-1">
            {entries.map(({ cls, count, color }) => (
              <li key={cls} className="flex items-center gap-2 text-[11px]">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-border/60"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{cls}</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      : <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-border/60 bg-background/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground shadow-sm backdrop-blur-md hover:text-foreground"
          aria-label={t('graphLegendShow')}
        >
          {t('graphLegendShow')}
        </button>
      }
    </div>
  );
}