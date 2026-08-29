'use client';

import { useTranslations } from 'next-intl';
import { IconSearch, IconX } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { glassCard } from '@/lib/design';
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
}

/**
 * Search plus the seven top-level heritage domains.
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
}: FilterBarProps) {
  const t = useTranslations('heritageMuseum.filters');
  const categories = (
    Object.entries(HG_CATEGORY_CONFIG) as [HgCategory, (typeof HG_CATEGORY_CONFIG)[HgCategory]][]
  ).filter(([cat]) => !categoryCounts || (categoryCounts[cat] ?? 0) > 0);
  const allCatsActive = activeCategoryFilter.size >= categories.length;

  return (
    <div
      className={cn(glassCard, 'flex flex-col gap-2.5 px-4 py-3 border-b border-border rounded-none shadow-none')}
      role="region"
      aria-label={t('regionLabel')}
    >
      <div className="relative">
        <IconSearch
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          aria-hidden
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="pl-9 pr-20 rounded-full bg-background/80"
          aria-label={t('searchAria')}
        />
        {typeof totalNodes === 'number' && typeof visibleNodes === 'number' && (
          <span className="absolute right-9 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono pointer-events-none">
            {visibleNodes}/{totalNodes}
          </span>
        )}
        {searchQuery && (
          <Button
            onClick={() => onSearchChange('')}
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            aria-label={t('searchAria')}
            type="button"
          >
            <IconX className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest mr-1 shrink-0">
          {t('domain')}
        </span>
        {categories.map(([cat, cfg]) => {
          const isActive = activeCategoryFilter.has(cat);
          const count = categoryCounts?.[cat];
          return (
            /*
             * Neutral chips, not tinted ones.
             *
             * These carried the node-identity hue as their text colour over a
             * 16% wash of the same hue. Measured in-page at 1440px, every
             * category came out at 3.82–3.87:1 while ACTIVE, and roughly
             * 2.2–2.5:1 inactive, where the colour was additionally set at
             * `${cfg.color}99`. One value was doing two jobs: identifying a
             * node in the force graph, where saturation earns its keep, and
             * labelling text on a light surface, where it cannot.
             *
             * The hue is gone from the text. Identity is carried by the glyph,
             * which also removes the hue-only encoding, and the ink is a token
             * pair that is legible in both themes by construction.
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
              {typeof count === 'number' && (
                <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
              )}
            </button>
          );
        })}
        {!allCatsActive && (
          <Button
            onClick={onShowAllCategories}
            type="button"
            variant="link"
            className="h-auto p-0 text-[10px] text-muted-foreground"
          >
            {t('showAll')}
          </Button>
        )}
      </div>
    </div>
  );
}
