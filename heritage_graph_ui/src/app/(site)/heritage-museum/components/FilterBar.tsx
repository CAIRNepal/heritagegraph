'use client';

import { useTranslations } from 'next-intl';
import { IconFilter, IconSearch, IconX } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { HG_CATEGORY_CONFIG, type HgCategory, type NodeType } from '../heritage-data';
import { NodeGlyph } from '../node-icons';

/**
 * One representative glyph per domain, so type is never carried by hue alone.
 *
 * Chosen deliberately rather than taking the first member of each category:
 * these are the shapes a visitor is most likely to recognise as standing for
 * the group. The glyph inherits `currentColor`, so it recolours with the chip.
 */
const CATEGORY_GLYPH: Record<HgCategory, NodeType> = {
  tangible: 'Temple',
  conceptual: 'Deity',
  event: 'Festival',
  spatial: 'Place',
  temporal: 'TimeSpan',
  actor: 'Person',
  provenance: 'Source',
};

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCategoryFilter: Set<HgCategory>;
  onCategoryToggle: (cat: HgCategory) => void;
  onShowAllCategories?: () => void;
  /** Corpus-wide node count per category. Categories absent here are not offered. */
  categoryCounts?: Record<string, number>;
  totalNodes?: number;
  visibleNodes?: number;
  /** How many of the visible nodes carry a photograph. */
  withMediaCount?: number;
}

/**
 * The museum's one search field, plus the seven domains behind a disclosure.
 *
 * This used to be a full-width band of its own, stacked under the toolbar: a
 * search row and then a row of seven chips, which together pushed the first card
 * to 482px and put every control above the only thing that said what the page
 * was. It is inline in the masthead now, and the chips are in a popover with a
 * count on the trigger — a visitor who wants to filter can, and a visitor who
 * does not is not handed seven decisions before seeing a photograph.
 *
 * It is also the page's ONLY search now. There were three — this one, the
 * global ⌘K, and a third in the Heritage Explorer rail — with no way to tell
 * which did what. The rail is gone and this one is labelled.
 *
 * Ontology classes belong in the legend (Connections view only).
 */
export function FilterBar({
  searchQuery,
  onSearchChange,
  activeCategoryFilter,
  onCategoryToggle,
  onShowAllCategories,
  categoryCounts,
  totalNodes,
  visibleNodes,
  withMediaCount,
}: FilterBarProps) {
  const t = useTranslations('heritageMuseum.filters');
  const categories = (
    Object.entries(HG_CATEGORY_CONFIG) as [HgCategory, (typeof HG_CATEGORY_CONFIG)[HgCategory]][]
  ).filter(([cat]) => !categoryCounts || (categoryCounts[cat] ?? 0) > 0);

  const activeCount = categories.filter(([cat]) => activeCategoryFilter.has(cat)).length;
  const filtered = activeCount < categories.length;

  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label={t('regionLabel')}>
      <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
        <IconSearch
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 rounded-full bg-background/80 pl-9 pr-8"
          aria-label={t('searchAria')}
        />
        {searchQuery ? (
          <Button
            onClick={() => onSearchChange('')}
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            aria-label={t('clearSearch')}
            type="button"
          >
            <IconX className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 shrink-0 gap-1.5 rounded-full text-xs"
          >
            <IconFilter className="h-3.5 w-3.5" aria-hidden />
            {t('domain')}
            {/* The count, not a dot: "3 of 7" tells a visitor what state they
                are in without opening the panel. */}
            <span className="font-mono tabular-nums text-muted-foreground">
              {filtered ? `${activeCount}/${categories.length}` : categories.length}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
              {t('domain')}
            </p>
            {filtered ? (
              <Button
                onClick={onShowAllCategories}
                type="button"
                variant="link"
                className="h-auto p-0 text-[11px]"
              >
                {t('showAll')}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map(([cat, cfg]) => {
              const isActive = activeCategoryFilter.has(cat);
              const count = categoryCounts?.[cat];
              return (
                /*
                 * Neutral chips, not tinted ones. These carried the
                 * node-identity hue as their text colour over a 16% wash of the
                 * same hue — 3.82-3.87:1 measured while active, ~2.2-2.5
                 * inactive. One value was doing two jobs: identifying a node in
                 * the force graph, where saturation earns its keep, and
                 * labelling text on a light surface, where it cannot. Identity
                 * is carried by the glyph, which also removes the hue-only
                 * encoding.
                 */
                <button
                  key={cat}
                  onClick={() => onCategoryToggle(cat)}
                  aria-pressed={isActive}
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'border-primary/40 bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
                  )}
                >
                  <NodeGlyph nodeType={CATEGORY_GLYPH[cat]} size={13} aria-hidden />
                  {cfg.label}
                  {typeof count === 'number' ? (
                    <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {typeof totalNodes === 'number' && typeof visibleNodes === 'number' ? (
        /* "46 of 46 places · 27 with imagery".
           The bare "46/46" inside the search field read like a character
           counter, and the gallery carried its own "ALL STORIES (46) · 27 WITH
           IMAGERY" label a few pixels below — the same count twice, thirty
           pixels apart. One statement, in the masthead, where the other counts
           already are. */
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {t('showingCount', { visible: visibleNodes, total: totalNodes })}
          {typeof withMediaCount === 'number' && withMediaCount > 0
            ? ` · ${t('showingWithMedia', { count: withMediaCount })}`
            : null}
        </span>
      ) : null}
    </div>
  );
}
