'use client';

import { useTranslations } from 'next-intl';
import { IconSearch, IconX } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { glassCard } from '@/lib/design';
import { cn } from '@/lib/utils';

import { HG_CATEGORY_CONFIG, type HgCategory } from '../heritage-data';

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
            <button
              key={cat}
              onClick={() => onCategoryToggle(cat)}
              aria-pressed={isActive}
              type="button"
              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full border font-medium transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-ring/40"
              style={{
                borderColor: isActive ? cfg.border : `${cfg.color}33`,
                background: isActive ? `${cfg.color}28` : 'transparent',
                color: isActive ? cfg.color : `${cfg.color}99`,
              }}
            >
              {cfg.label}
              {typeof count === 'number' && (
                <span className="font-mono text-[10px] opacity-70">{count}</span>
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
