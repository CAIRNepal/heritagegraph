'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DataSource } from '@/types/atlas';

import { ProvenanceBadge } from '../components/provenance-badge';
import { tierFromAssertionSources } from '@/lib/atlas-provenance-helpers';
import { cn } from '@/lib/utils';

import { useAtlasStore } from '../hooks/use-atlas-store';

interface DocumentsViewProps {
  compact?: boolean;
}

export function DocumentsView({ compact = false }: DocumentsViewProps) {
  const t = useTranslations('Atlas');

  const sources = useAtlasStore((s) => s.sources);
  const entities = useAtlasStore((s) => s.entities);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const focusView = useAtlasStore((s) => s.focusView);

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(sources[0]?.id ?? null);

  const selectedSource =
    selectedSourceId != null ? sources.find((s) => s.id === selectedSourceId) ?? null : null;

  const citingRows = useMemo(() => {
    if (!selectedSource) return [];
    const rows: {
      entityId: string;
      assertionId: string;
      property: string;
      value: string;
      confidence: number;
    }[] = [];
    for (const e of entities) {
      for (const a of e.assertions) {
        if (a.derivedFromSourceIds.includes(selectedSource.id)) {
          rows.push({
            entityId: e.id,
            assertionId: a.id,
            property: a.assertedProperty,
            value: a.assertedValue,
            confidence: a.confidenceScore,
          });
        }
      }
    }
    return rows;
  }, [entities, selectedSource]);

  return (
    <div
      className={cn(
        'min-h-0 flex-1 gap-2',
        compact ?
          'flex h-full min-h-0 flex-col px-1 pb-1'
        : 'grid px-2 pb-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:pl-16 md:pr-2 md:pt-14',
      )}
    >
      <ScrollArea
        className={cn(
          'rounded-xl border border-border/60 bg-background/70 backdrop-blur-md',
          compact ? 'max-h-[42%] min-h-0 shrink-0 lg:max-h-[46%]' : '',
        )}
      >
        <div className={cn('space-y-1', compact ? 'p-2' : 'p-3')}>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('documentsSources')}
          </p>
          {sources.map((src: DataSource) => (
            <button
              key={src.id}
              type="button"
              className={[
                'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                selectedSourceId === src.id ?
                  'border-primary/60 bg-primary/10'
                : 'border-border/50 bg-muted/30 hover:bg-muted/50',
              ].join(' ')}
              onClick={() => setSelectedSourceId(src.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{src.name}</span>
                <span className="font-mono text-[10px] font-semibold text-primary">
                  {src.reliabilityTier}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">{src.sourceType}</p>
            </button>
          ))}
        </div>
      </ScrollArea>

      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/60 bg-background/70 backdrop-blur-md">
        <div className={cn('border-b border-border/60', compact ? 'px-2 py-1.5' : 'px-3 py-2')}>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {t('documentsEvidence')}
          </p>
          {selectedSource ? (
            <p className="text-sm font-semibold">{selectedSource.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('pickSource')}</p>
          )}
        </div>
        <ScrollArea className={cn(compact ? 'min-h-0 flex-1' : 'min-h-[280px] flex-1')}>
          <ul className={cn('space-y-2', compact ? 'p-2' : 'p-3')}>
            {citingRows.map((row) => {
              const ent = entities.find((e) => e.id === row.entityId);
              const assertion = ent?.assertions.find((a) => a.id === row.assertionId);
              const tier =
                assertion ? tierFromAssertionSources(assertion, sources) : null;

              return (
                <li
                  key={`${row.entityId}-${row.assertionId}`}
                  className="rounded-lg border border-border/50 bg-muted/25 p-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm font-semibold"
                      type="button"
                      onClick={() => {
                        selectEntity(row.entityId);
                        focusView(null);
                      }}
                    >
                      {ent?.name ?? row.entityId}
                    </Button>
                    {assertion ? (
                      <ProvenanceBadge assertion={assertion} tier={tier} compact />
                    ) : null}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">{row.property}</p>
                  <p className="text-xs">{row.value}</p>
                </li>
              );
            })}
          </ul>
          {selectedSource && citingRows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('noCitations')}</p>
          ) : null}
        </ScrollArea>
      </div>
    </div>
  );
}
