'use client';

import { rankItem } from '@tanstack/match-sorter-utils';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AtlasEra, OntologyClass } from '@/types/atlas';
import { ONTOLOGY_CLASSES } from '@/types/atlas';

import { cn } from '@/lib/utils';

import { AtlasKnowledgeLink } from '../components/atlas-knowledge-link';
import { ProvenanceBadge } from '../components/provenance-badge';
import { tierFromAssertionSources } from '@/lib/atlas-provenance-helpers';
import { ATLAS_ERAS_ORDER, useAtlasStore, useFilteredAtlasEntities } from '../hooks/use-atlas-store';

interface SearchViewProps {
  compact?: boolean;
}

export function SearchView({ compact = false }: SearchViewProps) {
  const t = useTranslations('Atlas');

  const base = useFilteredAtlasEntities();
  const sources = useAtlasStore((s) => s.sources);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const focusView = useAtlasStore((s) => s.focusView);

  const [query, setQuery] = useState('');
  const [eraFilter, setEraFilter] = useState<string>('any');
  const [classFilter, setClassFilter] = useState<string>('any');
  const [visibleCount, setVisibleCount] = useState(24);

  const SEARCH_PAGE = 24;

  useEffect(() => {
    setVisibleCount(SEARCH_PAGE);
  }, [query, eraFilter, classFilter, base.length]);

  const results = useMemo(() => {
    const q = query.trim();
    return base.filter((e) => {
      if (eraFilter !== 'any' && e.era !== eraFilter) return false;
      if (classFilter !== 'any' && e.class !== classFilter) return false;
      if (!q) return true;
      const rName = rankItem(e.name, q);
      const rNe = e.nameNe ? rankItem(e.nameNe, q) : { passed: false };
      const rSum = rankItem(e.summary, q);
      return Boolean(rName.passed || rNe.passed || rSum.passed);
    });
  }, [base, query, eraFilter, classFilter]);

  const latestAssertion = (e: (typeof base)[0]) =>
    [...e.assertions].sort((a, b) => b.generatedAtTime.localeCompare(a.generatedAtTime))[0];

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-3',
        compact ? 'h-full px-1 pb-1' : 'px-2 pb-2 md:pl-16 md:pr-2 md:pt-14',
      )}
    >
      <div
        className={cn(
          'rounded-xl border border-border/60 bg-background/75 backdrop-blur-md',
          compact ? 'p-2' : 'p-3',
        )}
      >
        <Label htmlFor="atlas-search-input" className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {t('searchLabel')}
        </Label>
        <Input
          id="atlas-search-input"
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          placeholder={t('searchPlaceholder')}
          className="mt-1 font-mono text-sm"
          autoComplete="off"
        />
        <div className={cn('mt-3 grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2')}>
          <div>
            <Label className="text-[10px] text-muted-foreground">{t('filterEra')}</Label>
            <Select value={eraFilter} onValueChange={setEraFilter}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t('any')}</SelectItem>
                {ATLAS_ERAS_ORDER.map((er: AtlasEra) => (
                  <SelectItem key={er} value={er}>
                    {er.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">{t('filterClass')}</Label>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="mt-1 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="any">{t('any')}</SelectItem>
                {ONTOLOGY_CLASSES.map((c: OntologyClass) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <ScrollArea
        className={cn(
          'flex-1 rounded-xl border border-border/60 bg-background/60 backdrop-blur-md',
          compact ? 'min-h-0' : 'min-h-[320px]',
        )}
      >
        <p className="border-b border-border/50 px-3 py-2 font-mono text-[10px] text-muted-foreground">
          {t('searchResultCount', { count: results.length })}
        </p>
        {results.length === 0 ?
          <p className="p-6 text-center text-sm text-muted-foreground">{t('searchNoResults')}</p>
        : null}
        <div className={cn('grid gap-2', compact ? 'p-2 sm:grid-cols-1' : 'p-3 sm:grid-cols-2 lg:grid-cols-3')}>
          {visibleResults.map((e) => {
            const la = latestAssertion(e);
            const tier = la ? tierFromAssertionSources(la, sources) : null;
            return (
              <div
                key={e.id}
                className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/25 p-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{e.class}</p>
                  </div>
                  {la ? <ProvenanceBadge assertion={la} tier={tier} compact /> : null}
                </div>
                <p className="line-clamp-3 text-muted-foreground">{e.summary}</p>
                <div className="mt-auto flex flex-wrap gap-1">
                  <AtlasKnowledgeLink entity={e} className="h-7 text-[11px]" />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      selectEntity(e.id);
                      focusView(null);
                    }}
                  >
                    {t('pinGlobe')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      selectEntity(e.id);
                      focusView('graph');
                    }}
                  >
                    {t('openGraph')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {hasMore ?
          <div className="border-t border-border/50 p-2 text-center">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 text-[11px]"
              onClick={() => setVisibleCount((n) => n + SEARCH_PAGE)}
            >
              {t('searchLoadMore', { remaining: results.length - visibleCount })}
            </Button>
          </div>
        : null}
      </ScrollArea>
    </div>
  );
}
