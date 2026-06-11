'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import { ProvenanceBadge } from '../components/provenance-badge';
import { tierFromAssertionSources } from '@/lib/atlas-provenance-helpers';
import { useAtlasStore } from '../hooks/use-atlas-store';

interface OpsDashboardViewProps {
  compact?: boolean;
}

export function OpsDashboardView({ compact = false }: OpsDashboardViewProps) {
  const t = useTranslations('Atlas');

  const entities = useAtlasStore((s) => s.entities);
  const sources = useAtlasStore((s) => s.sources);
  const dataSource = useAtlasStore((s) => s.dataSource);
  const datasetMeta = useAtlasStore((s) => s.datasetMeta);

  const kpis = useMemo(() => {
    let assertions = 0;
    let conflicts = 0;
    const tierCount: Record<'A' | 'B' | 'C' | 'D', number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const e of entities) {
      assertions += e.assertions.length;
      conflicts += e.assertions.filter((a) => a.reconciliationStatus === 'conflicting').length;
    }
    for (const s of sources) {
      tierCount[s.reliabilityTier] += 1;
    }
    const contributors = new Set(
      entities.flatMap((e) => e.assertions.map((a) => a.attributedToAgentId)),
    ).size;

    return {
      entities: entities.length,
      assertions,
      conflicts,
      tierCount,
      contributors,
      restorationAlerts: Math.min(12, conflicts + Math.floor(assertions / 40)),
    };
  }, [entities, sources]);

  const activity = useMemo(() => {
    const rows = entities.flatMap((e) =>
      e.assertions.map((a) => ({
        iso: a.generatedAtTime,
        entityId: e.id,
        entityName: e.name,
        assertion: a,
      })),
    );
    rows.sort((a, b) => b.iso.localeCompare(a.iso));
    return rows.slice(0, 20);
  }, [entities]);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-3',
        compact ? 'h-full px-1 pb-1' : 'px-2 pb-2 md:pl-16 md:pr-2 md:pt-14',
      )}
    >
      <div
        className={cn('grid gap-2', compact ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4')}
      >
        <div
          className={cn(
            'rounded-xl border border-border/60 bg-background/75 backdrop-blur-md',
            compact ? 'p-2' : 'p-3',
          )}
        >
          <p className="font-mono text-[10px] uppercase text-muted-foreground">{t('opsEntities')}</p>
          <p
            className={cn(
              'font-mono tabular-nums text-foreground',
              compact ? 'text-lg' : 'text-2xl',
            )}
          >
            {kpis.entities}
          </p>
        </div>
        <div
          className={cn(
            'rounded-xl border border-border/60 bg-background/75 backdrop-blur-md',
            compact ? 'p-2' : 'p-3',
          )}
        >
          <p className="font-mono text-[10px] uppercase text-muted-foreground">{t('opsAssertions')}</p>
          <p
            className={cn(
              'font-mono tabular-nums text-foreground',
              compact ? 'text-lg' : 'text-2xl',
            )}
          >
            {kpis.assertions}
          </p>
        </div>
        <div
          className={cn(
            'rounded-xl border border-border/60 bg-background/75 backdrop-blur-md',
            compact ? 'p-2' : 'p-3',
          )}
        >
          <p className="font-mono text-[10px] uppercase text-muted-foreground">{t('opsConflicts')}</p>
          <p
            className={cn(
              'font-mono tabular-nums text-destructive',
              compact ? 'text-lg' : 'text-2xl',
            )}
          >
            {kpis.conflicts}
          </p>
        </div>
        <div
          className={cn(
            'rounded-xl border border-border/60 bg-background/75 backdrop-blur-md',
            compact ? 'p-2' : 'p-3',
          )}
        >
          <p className="font-mono text-[10px] uppercase text-muted-foreground">{t('opsContributors')}</p>
          <p
            className={cn(
              'font-mono tabular-nums text-foreground',
              compact ? 'text-lg' : 'text-2xl',
            )}
          >
            {kpis.contributors}
          </p>
        </div>
      </div>

      <div
        className={cn(
          'rounded-xl border border-border/60 bg-background/70 backdrop-blur-md',
          compact ? 'p-2' : 'p-3',
        )}
      >
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {t('opsSourcesByTier')}
        </p>
        <div className="mt-2 grid grid-cols-4 gap-2 font-mono text-xs">
          {(['A', 'B', 'C', 'D'] as const).map((tier) => (
            <div key={tier} className="rounded-md bg-muted/40 px-2 py-1 text-center">
              <span className="text-muted-foreground">{tier}</span>{' '}
              <span className="text-foreground">{kpis.tierCount[tier]}</span>
            </div>
          ))}
        </div>
        {dataSource === 'live' && datasetMeta ?
          <p className={cn('mt-3 font-mono text-muted-foreground', compact ? 'text-[9px]' : 'text-[10px]')}>
            {t('opsDatasetMeta', {
              nodes: datasetMeta.nodeCount,
              edges: datasetMeta.edgeCount,
              prov: datasetMeta.edgesWithProvenance ?? 0,
            })}
          </p>
        : (
          <p className={cn('mt-3 font-mono text-muted-foreground', compact ? 'text-[9px]' : 'text-[10px]')}>
            {t('opsRestorationAlerts', { n: kpis.restorationAlerts })}
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/60 bg-background/70 backdrop-blur-md">
        <div
          className={cn(
            'border-b border-border/60 font-mono uppercase tracking-wide text-muted-foreground',
            compact ? 'px-2 py-1.5 text-[9px]' : 'px-3 py-2 text-[10px]',
          )}
        >
          {t('opsActivity')}
        </div>
        <ScrollArea className={cn(compact ? 'h-[min(28vh,200px)]' : 'h-[min(50vh,420px)]')}>
          <ul className="divide-y divide-border/40">
            {activity.map((row) => {
              const tier = tierFromAssertionSources(row.assertion, sources);
              return (
                <li key={`${row.entityId}-${row.assertion.id}`} className="flex flex-wrap items-start gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.entityName}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {row.iso.replace('T', ' ').slice(0, 16)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.assertion.assertedProperty}: {row.assertion.assertedValue.slice(0, 120)}
                    </p>
                  </div>
                  <ProvenanceBadge assertion={row.assertion} tier={tier} />
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </div>
    </div>
  );
}
