'use client';

import {
  IconAffiliate,
  IconArticle,
  IconBook,
  IconCertificate,
  IconTimeline,
  IconX,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import {
  atlasEntityClassLabel,
  atlasEntityIsOnGlobe,
} from '@/lib/atlas-entity-display';

import { useAtlasStore, useAtlasViewEdges, useFilteredAtlasEntities } from '../hooks/use-atlas-store';
import { AtlasKnowledgeLink } from './atlas-knowledge-link';
import { CoordProvenanceBadge } from './coord-provenance-badge';
import { ProvenancePanel } from './provenance-panel';

type DetailTab = 'overview' | 'provenance' | 'timeline' | 'relations' | 'sources';

function eventKindLabel(kind: string): string {
  switch (kind) {
    case 'built':
      return 'Built';
    case 'renovated':
      return 'Renovated';
    case 'damaged':
      return 'Damaged';
    case 'restored':
      return 'Restored';
    case 'rediscovered':
      return 'Rediscovered';
    case 'consecrated':
      return 'Consecrated';
    case 'documented':
      return 'Documented';
    default:
      return kind;
  }
}

const RAIL_TABS: { id: DetailTab; icon: typeof IconArticle; titleKey: 'tabOverview' | 'tabProvenance' | 'tabTimeline' | 'tabRelations' | 'tabSources' }[] = [
  { id: 'overview', icon: IconArticle, titleKey: 'tabOverview' },
  { id: 'provenance', icon: IconCertificate, titleKey: 'tabProvenance' },
  { id: 'timeline', icon: IconTimeline, titleKey: 'tabTimeline' },
  { id: 'relations', icon: IconAffiliate, titleKey: 'tabRelations' },
  { id: 'sources', icon: IconBook, titleKey: 'tabSources' },
];

export function EntityPanel() {
  const t = useTranslations('Atlas');

  const filteredEntities = useFilteredAtlasEntities();
  const viewEdges = useAtlasViewEdges();
  const sources = useAtlasStore((s) => s.sources);
  const selectedId = useAtlasStore((s) => s.selectedId);
  const panelOpen = useAtlasStore((s) => s.panelOpen);
  const currentYear = useAtlasStore((s) => s.currentYear);
  const togglePanel = useAtlasStore((s) => s.togglePanel);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const getEntityById = useAtlasStore((s) => s.getEntityById);

  const [detailTab, setDetailTab] = useState<DetailTab | null>('overview');

  const entity = selectedId ? getEntityById(selectedId) : undefined;
  const entityInFilter = entity != null && filteredEntities.some((e) => e.id === entity.id);

  const relatedEdges =
    entity != null ? viewEdges.filter((ed) => ed.source === entity.id || ed.target === entity.id) : [];

  useEffect(() => {
    if (selectedId) setDetailTab('overview');
    else setDetailTab(null);
  }, [selectedId]);

  const showTimeline = true;
  const bottomOffset = showTimeline
    ? 'calc(0.5rem + var(--atlas-dock-h, 72px) + 0.25rem)'
    : '0.5rem';
  const topOffset = 'calc(0.5rem + var(--atlas-bar-h, 36px) + 0.25rem)';

  const pickTab = (tab: DetailTab) => {
    setDetailTab((cur) => (cur === tab ? null : tab));
  };

  const sourceCount =
    entity ?
      new Set(entity.assertions.flatMap((a) => a.derivedFromSourceIds)).size
    : 0;
  const agentCount =
    entity ? new Set(entity.assertions.map((a) => a.attributedToAgentId)).size : 0;
  const conflictEntityCount =
    entity ?
      entity.assertions.filter((a) => a.reconciliationStatus === 'conflicting').length
    : 0;

  return (
    <AnimatePresence>
      {panelOpen ?
        <motion.aside
          key="entity-panel"
          initial={{ opacity: 0.001, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0.001, x: 24 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="pointer-events-auto absolute z-30 flex overflow-hidden rounded-none border-l border-border/60 bg-background/80 shadow-xl backdrop-blur-md md:rounded-l-xl"
          style={{
            top: topOffset,
            bottom: bottomOffset,
            right: 0,
          }}
          aria-hidden={false}
          aria-labelledby="atlas-panel-title"
        >
          {!entity ?
            <div className="flex w-full min-w-0 max-w-sm flex-col md:max-w-md">
              <div className="atlas-card-header border-b border-border/60">
                <h2 id="atlas-panel-title" className="text-xs font-semibold tracking-tight">
                  {t('heritageDetail')}
                </h2>
                <Button variant="ghost" size="sm" type="button" className="h-7 px-2 text-xs" onClick={() => togglePanel()}>
                  {t('close')}
                  <span className="sr-only">{t('closeShortcut')}</span>
                </Button>
              </div>
              <p className="p-3 text-xs leading-snug text-muted-foreground">{t('selectPrompt')}</p>
            </div>
          : <div className="flex min-h-0 flex-1">
              <nav
                className="flex w-14 shrink-0 flex-col items-stretch gap-0.5 border-r border-border/50 bg-background/60 py-1 pl-1"
                aria-label={t('heritageDetail')}
              >
                <h2 id="atlas-panel-title" className="sr-only">
                  {t('heritageDetail')}
                </h2>
                {RAIL_TABS.map(({ id, icon: Icon, titleKey }) => {
                  const active = detailTab === id;
                  return (
                    <Button
                      key={id}
                      type="button"
                      variant={active ? 'default' : 'ghost'}
                      size="icon"
                      className={cn(
                        'relative h-9 w-9 shrink-0 rounded-md',
                        active && 'border-l-2 border-l-primary-foreground/90',
                      )}
                      title={t(titleKey)}
                      onClick={() => pickTab(id)}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span className="sr-only">{t(titleKey)}</span>
                    </Button>
                  );
                })}
                <div className="mt-auto flex flex-col gap-0.5 pb-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-md"
                    title={t('close')}
                    onClick={() => togglePanel()}
                  >
                    <IconX className="h-4 w-4" aria-hidden />
                    <span className="sr-only">
                      {t('close')} {t('closeShortcut')}
                    </span>
                  </Button>
                </div>
              </nav>

              <motion.div
                className="flex min-h-0"
                initial={false}
                animate={{ width: detailTab ? 384 : 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}
              >
                <div className="flex h-full w-[400px] min-w-[400px] max-w-[min(400px,100vw)] flex-col overflow-hidden border-l border-border/40 bg-background/75">
                  {!entityInFilter ?
                    <p className="mx-2 mt-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-950 dark:text-amber-100">
                      {t('selectionHiddenByFilters')}
                    </p>
                  : null}

                  <div className="shrink-0 space-y-2 border-b border-border/50 px-3 py-2">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[15px] font-semibold leading-tight tracking-tight">
                        {entity.name}
                      </span>
                      {entity.nameNe ?
                        <span className="text-[11px] text-muted-foreground">{entity.nameNe}</span>
                      : null}
                      <span className="rounded border border-border/60 bg-muted/35 px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {atlasEntityClassLabel(entity)}
                      </span>
                      {entity.coordProvenance ?
                        <CoordProvenanceBadge provenance={entity.coordProvenance} compact />
                      : null}
                      <span className="rounded border border-border/60 bg-muted/35 px-1.5 py-px font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                        {entity.era.replace('_', ' ')}
                      </span>
                      {entity.foundedYear != null ?
                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                          {entity.foundedYear}
                        </span>
                      : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AtlasKnowledgeLink entity={entity} className="h-7 text-[11px]" />
                    </div>
                    <div className="grid grid-cols-4 gap-1 font-mono text-[9px] uppercase leading-none tracking-wide text-muted-foreground">
                      <span className="truncate rounded border border-border/40 bg-muted/25 px-1 py-1 text-center tabular-nums">
                        {t('kpiAssertions', { count: entity.assertions.length })}
                      </span>
                      <span className="truncate rounded border border-border/40 bg-muted/25 px-1 py-1 text-center tabular-nums">
                        {t('kpiSources', { count: sourceCount })}
                      </span>
                      <span className="truncate rounded border border-border/40 bg-muted/25 px-1 py-1 text-center tabular-nums">
                        {t('kpiConflicts', { count: conflictEntityCount })}
                      </span>
                      <span className="truncate rounded border border-border/40 bg-muted/25 px-1 py-1 text-center tabular-nums">
                        {t('kpiAgents', { count: agentCount })}
                      </span>
                    </div>
                  </div>

                  <ScrollArea className="min-h-0 flex-1">
                    <div className="p-3">
                      {detailTab === 'overview' ?
                        <div className="space-y-2">
                          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                            {t('yearFilteredHint', { year: currentYear })}
                          </p>
                          <p className="text-[13px] leading-snug">{entity.summary}</p>
                          <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 text-[11px]">
                            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                              {t('geoSection')}
                            </p>
                            {entity.lat != null && entity.lon != null ?
                              <p className="mt-1 font-mono tabular-nums">
                                {entity.lat.toFixed(5)}°, {entity.lon.toFixed(5)}°
                              </p>
                            : (
                              <p className="mt-1 text-muted-foreground">{t('geoUnmapped')}</p>
                            )}
                            {entity.coordProvenance ?
                              <p className="mt-1 text-muted-foreground leading-snug">
                                {t(`${entity.coordProvenance === 'verified' ? 'coordVerified' : entity.coordProvenance === 'gazetteer' ? 'coordGazetteer' : entity.coordProvenance === 'inherited' ? 'coordInherited' : 'coordUnmapped'}Hint`)}
                              </p>
                            : null}
                            {!atlasEntityIsOnGlobe(entity) ?
                              <p className="mt-1 text-amber-800 dark:text-amber-200">
                                {t('geoCatalogOnly')}
                              </p>
                            : null}
                          </div>
                          {entity.ritualType ?
                            <p className="text-[11px] text-muted-foreground">
                              {t('ritualType')} {entity.ritualType}
                            </p>
                          : null}
                          {entity.anchorEntityIds?.length ?
                            <p className="text-[11px] text-muted-foreground">
                              {t('anchors')} {entity.anchorEntityIds.length}
                            </p>
                          : null}
                        </div>
                      : null}

                      {detailTab === 'provenance' ?
                        <ProvenancePanel assertions={entity.assertions} sources={sources} />
                      : null}

                      {detailTab === 'timeline' ?
                        <div className="space-y-2">
                          <p className="text-[11px] text-muted-foreground">
                            {t('timelineHint', { year: currentYear })}
                          </p>
                          <ul className="space-y-1.5">
                            {entity.events
                              .slice()
                              .sort((a, b) => a.year - b.year)
                              .map((ev) => (
                                <li
                                  key={`${entity.id}-${ev.year}-${ev.kind}`}
                                  className="rounded-md border border-border/50 bg-muted/25 px-2 py-1.5 text-[13px]"
                                >
                                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                                    {ev.year}
                                  </span>{' '}
                                  <span className="font-medium">{eventKindLabel(ev.kind)}</span>
                                  <p className="mt-0.5 text-[12px] text-muted-foreground">{ev.description}</p>
                                </li>
                              ))}
                          </ul>
                        </div>
                      : null}

                      {detailTab === 'relations' ?
                        <div className="space-y-1.5">
                          {relatedEdges.length === 0 ?
                            <p className="text-xs text-muted-foreground">{t('noEdges')}</p>
                          : (
                            <ul className="space-y-1.5">
                              {relatedEdges.map((ed) => {
                                const other = ed.source === entity.id ? ed.target : ed.source;
                                const otherRow = getEntityById(other);
                                return (
                                  <li key={ed.id}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-auto w-full justify-start py-1.5 text-left"
                                      type="button"
                                      onClick={() => selectEntity(other)}
                                    >
                                      <span className="block w-full font-mono text-[10px] text-muted-foreground">
                                        {ed.predicate}
                                      </span>
                                      <span className="block text-[13px] font-medium">
                                        {otherRow?.name ?? other}
                                      </span>
                                      <span className="block text-[11px] text-muted-foreground">
                                        {otherRow?.class}
                                      </span>
                                    </Button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      : null}

                      {detailTab === 'sources' ?
                        <div className="space-y-1.5">
                          <ul className="space-y-1.5">
                            {[
                              ...new Set(entity.assertions.flatMap((a) => a.derivedFromSourceIds)),
                            ].map((sid) => {
                              const src = sources.find((s) => s.id === sid);
                              if (!src) return null;
                              return (
                                <li
                                  key={sid}
                                  className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-[13px]"
                                >
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-mono text-[10px] font-semibold text-primary">
                                      {src.reliabilityTier}
                                    </span>
                                    <span className="font-medium">{src.name}</span>
                                  </div>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">{src.citation}</p>
                                  {src.archivalLocation ?
                                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                      {src.archivalLocation}
                                    </p>
                                  : null}
                                </li>
                              );
                            })}
                          </ul>
                          {entity.assertions.every((a) => a.derivedFromSourceIds.length === 0) ?
                            <p className="text-xs text-muted-foreground">{t('noSourcesOnAssertions')}</p>
                          : null}
                        </div>
                      : null}
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            </div>
          }
        </motion.aside>
      : null}
    </AnimatePresence>
  );
}
