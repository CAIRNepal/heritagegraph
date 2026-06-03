'use client';

import { useTranslations } from 'next-intl';
import { IconSearch, IconX } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { glassCard } from '@/lib/design';
import { cn } from '@/lib/utils';

import { NODE_TYPE_CONFIG, HG_CATEGORY_CONFIG, type NodeType, type HgCategory } from '../heritage-data';
import { NodeGlyph } from '../node-icons';

interface FilterBarProps {
  activeTypes: Set<NodeType>;
  onToggle: (type: NodeType) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeCategoryFilter: Set<HgCategory>;
  onCategoryToggle: (cat: HgCategory) => void;
  onShowAllCategories?: () => void;
  onShowAllTypes?: () => void;
  totalNodes?: number;
  visibleNodes?: number;
}

export function FilterBar({
  activeTypes,
  onToggle,
  searchQuery,
  onSearchChange,
  activeCategoryFilter,
  onCategoryToggle,
  onShowAllCategories,
  onShowAllTypes,
  totalNodes,
  visibleNodes,
}: FilterBarProps) {
  const t = useTranslations('heritageMuseum.filters');
  const allCatsActive = activeCategoryFilter.size === Object.keys(HG_CATEGORY_CONFIG).length;
  const allTypesActive = activeTypes.size === Object.keys(NODE_TYPE_CONFIG).length;

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
        {(Object.entries(HG_CATEGORY_CONFIG) as [HgCategory, (typeof HG_CATEGORY_CONFIG)[HgCategory]][]).map(
          ([cat, cfg]) => {
            const isActive = activeCategoryFilter.has(cat);
            return (
              <button
                key={cat}
                onClick={() => onCategoryToggle(cat)}
                aria-pressed={isActive}
                type="button"
                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full border font-medium transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-ring/40"
                style={{
                  borderColor: isActive ? cfg.border : `${cfg.color}33`,
                  background: isActive ? `${cfg.color}28` : 'transparent',
                  color: isActive ? cfg.color : `${cfg.color}99`,
                }}
              >
                {cfg.label}
              </button>
            );
          },
        )}
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

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest mr-1 shrink-0">
          {t('class')}
        </span>
        {(Object.entries(NODE_TYPE_CONFIG) as [NodeType, (typeof NODE_TYPE_CONFIG)[NodeType]][]).map(
          ([type, cfg]) => {
            const isActive = activeTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => onToggle(type)}
                aria-pressed={isActive}
                type="button"
                title={cfg.cidocMapping}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-ring/40"
                style={{
                  borderColor: isActive ? cfg.color : `${cfg.color}44`,
                  background: isActive ? `${cfg.color}33` : `${cfg.color}0a`,
                  color: isActive ? cfg.glowColor : `${cfg.glowColor}99`,
                }}
              >
                <NodeGlyph nodeType={type} size={13} color={isActive ? cfg.glowColor : `${cfg.glowColor}99`} />
                <span>{cfg.label}</span>
              </button>
            );
          },
        )}
        {!allTypesActive && (
          <Button
            onClick={onShowAllTypes}
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
