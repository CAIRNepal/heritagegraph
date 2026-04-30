'use client';

import { IconTopologyStar } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

import { useAtlasStore } from '../hooks/use-atlas-store';

export function EntityHoverCard() {
  const t = useTranslations('Atlas');

  const hoveredEntityId = useAtlasStore((s) => s.hoveredEntityId);
  const hoverScreenPos = useAtlasStore((s) => s.hoverScreenPos);
  const getEntityById = useAtlasStore((s) => s.getEntityById);
  const getProvenanceSummary = useAtlasStore((s) => s.getProvenanceSummary);
  const agents = useAtlasStore((s) => s.agents);
  const sources = useAtlasStore((s) => s.sources);
  const focusView = useAtlasStore((s) => s.focusView);
  const selectEntity = useAtlasStore((s) => s.selectEntity);

  const entity =
    hoveredEntityId ? getEntityById(hoveredEntityId) : null;

  if (!entity || !hoverScreenPos) {
    return null;
  }

  const summary = getProvenanceSummary(entity.id);
  const latest = summary?.latestAssertion;
  const agentName =
    latest != null ? agents.find((a) => a.id === latest.attributedToAgentId)?.name : undefined;

  const topSourceTier =
    latest?.derivedFromSourceIds?.length ?
      sources.find((s) => latest!.derivedFromSourceIds.includes(s.id))?.reliabilityTier
    : undefined;

  const pct =
    latest != null ? `${Math.round(latest.confidenceScore * 100)}%` : undefined;

  return (
    <div
      className="pointer-events-auto fixed z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border/70 bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-md"
      style={{
        left: hoverScreenPos.x + 14,
        top: hoverScreenPos.y + 14,
      }}
      role="tooltip"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-sm">{entity.name}</p>
          {entity.nameNe ? (
            <p className="truncate text-xs text-muted-foreground">{entity.nameNe}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {entity.class}
        </span>
      </div>

      <p className="mt-2 line-clamp-3 text-xs leading-snug text-muted-foreground">{entity.summary}</p>

      {latest ? (
        <div className="mt-2 rounded-lg bg-muted/40 px-2 py-1.5 text-xs font-mono text-muted-foreground">
          <span className="text-foreground">{latest.assertedProperty}</span>
          {' → '}
          <span>{latest.assertedValue.slice(0, 72)}{latest.assertedValue.length > 72 ? '…' : ''}</span>
          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
            {agentName ? <span>{t('hoverByAgent', { name: agentName })}</span> : null}
            <span>{latest.generatedAtTime.slice(0, 10)}</span>
            {topSourceTier ? (
              <span>
                {t('tierShort')} {topSourceTier}
              </span>
            ) : null}
            {pct ? <span>{t('confidencePercent', { pct })}</span> : null}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{t('noAssertions')}</p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => {
            selectEntity(entity.id);
            focusView(null);
          }}
        >
          {t('pinGlobe')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => {
            selectEntity(entity.id);
            focusView('graph');
          }}
        >
          <IconTopologyStar className="mr-1 h-3.5 w-3.5" aria-hidden />
          {t('openGraph')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => {
            selectEntity(entity.id);
            focusView('time');
          }}
        >
          {t('openTimeline')}
        </Button>
      </div>
    </div>
  );
}
