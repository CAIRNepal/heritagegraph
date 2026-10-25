'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { IconSearch, IconX } from '@tabler/icons-react';

import { cn } from '@/lib/utils';

import { HG_CATEGORY_CONFIG, NODE_TYPE_CONFIG, type GraphNode, type HgCategory } from '../../heritage-data';
import { NodeGlyph } from '../../node-icons';
import { heroImageOf, sizedImage, useExhibitWords, yearOf } from './exhibit-utils';

interface RecordThumbProps {
  node: GraphNode;
  size: 'sm' | 'md';
}

/** Square thumbnail, or the record type's glyph when there is no usable photo. */
export function RecordThumb({ node, size }: RecordThumbProps) {
  // 0: sized thumbnail, 1: original upload, 2: give up and show the glyph.
  const [stage, setStage] = useState(0);
  const original = heroImageOf(node);
  const src = original ? (stage === 0 ? sizedImage(original, 120) : original) : undefined;
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  useEffect(() => setStage(0), [original]);
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden bg-muted',
        size === 'md' ? 'size-12 rounded-lg' : 'size-[34px] rounded-md',
      )}
      aria-hidden="true"
    >
      {src && stage < 2 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setStage((s) => s + 1)} className="size-full object-cover" />
      ) : (
        <span className="grid size-[60%] place-items-center rounded-full" style={{ background: cfg?.color }}>
          <NodeGlyph nodeType={node.nodeType} size={size === 'md' ? 15 : 11} color="var(--node-glyph)" />
        </span>
      )}
    </span>
  );
}

interface CollectionRailProps {
  allNodes: GraphNode[];
  visibleNodes: GraphNode[];
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  kind: HgCategory | null;
  onKindChange: (kind: HgCategory | null) => void;
  /** Data-source line, Sources popover and the like, under the title. */
  controls?: ReactNode;
  /** More filters and actions under the kind chips (period, time walk). */
  filters?: ReactNode;
  /** Clear every filter, not only search and kind. */
  onResetFilters?: () => void;
  /** False in the phone sheet, where the page bar already carries the title. */
  showTitle?: boolean;
}

/**
 * The collection, always in view: search, filter by kind, and a list of every
 * record with its thumbnail, kind and date. Up/Down moves through the list and
 * opens each record as it goes, so the list doubles as a reader's index.
 */
export function CollectionRail({
  allNodes,
  visibleNodes,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  kind,
  onKindChange,
  controls,
  filters,
  onResetFilters,
  showTitle = true,
}: CollectionRailProps) {
  const t = useTranslations('heritageMuseum');
  const tx = useTranslations('heritageMuseum.exhibit');
  const words = useExhibitWords();
  const listRef = useRef<HTMLUListElement>(null);

  const counts: Partial<Record<HgCategory, number>> = {};
  for (const n of allNodes) counts[n.hgCategory] = (counts[n.hgCategory] ?? 0) + 1;
  const kinds = (Object.keys(HG_CATEGORY_CONFIG) as HgCategory[]).filter((k) => counts[k]);

  // Keep the open record in view when it changes from elsewhere (map, graph, Next).
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const move = (from: HTMLElement, step: 1 | -1) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-id]') ?? [])];
    const k = items.indexOf(from as HTMLButtonElement);
    const next = items[Math.max(0, Math.min(items.length - 1, k + step))];
    if (!next || next === from) return;
    next.focus();
    const node = visibleNodes.find((n) => n.id === next.dataset.id);
    if (node) onSelect(node);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid gap-3 border-b border-border px-[18px] pt-5 pb-3">
        <div className="grid gap-1.5">
          {showTitle ? <h1 className="font-serif text-[1.65rem] leading-tight text-foreground">{t('title')}</h1> : null}
          <p className="text-[13px] leading-relaxed text-muted-foreground">{tx('railLede')}</p>
        </div>
        {controls}
        <div role="search" className="relative">
          <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="museum-search" className="sr-only">
            {tx('searchLabel')}
          </label>
          <input
            id="museum-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchQuery) onSearchChange('');
            }}
            placeholder={tx('searchPlaceholder')}
            autoComplete="off"
            className="h-10 w-full rounded-full border border-border bg-card pr-9 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-2 focus:outline-ring [&::-webkit-search-cancel-button]:appearance-none"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label={tx('clearSearch')}
              className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              <IconX className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        <div role="group" aria-label={tx('kindsLabel')} className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => onKindChange(kind === k ? null : k)}
              className={cn(
                'inline-flex min-h-[30px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                kind === k ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:border-muted-foreground',
              )}
            >
              <span className="size-2 rounded-full" style={{ background: HG_CATEGORY_CONFIG[k].color }} aria-hidden />
              {HG_CATEGORY_CONFIG[k].label}
              <span className={cn('tabular-nums', kind === k ? 'opacity-70' : 'text-muted-foreground')}>{counts[k]}</span>
            </button>
          ))}
        </div>
        {filters}
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {tx('count', {
            shown: visibleNodes.length,
            total: allNodes.length,
            withPhoto: visibleNodes.filter((n) => heroImageOf(n)).length,
          })}
        </p>
      </div>

      <ul ref={listRef} className="min-h-0 flex-1 overflow-auto p-1.5">
        {visibleNodes.length === 0 ? (
          <li className="grid justify-items-start gap-2 p-3 text-sm text-muted-foreground">
            {tx('noMatches')}
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onKindChange(null);
                onResetFilters?.();
              }}
              className="cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 text-foreground"
            >
              {tx('resetFilters')}
            </button>
          </li>
        ) : (
          visibleNodes.map((n) => {
            const y = yearOf(n);
            const current = n.id === selectedId;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  data-id={n.id}
                  aria-current={current}
                  onClick={() => onSelect(n)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      move(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
                    }
                  }}
                  className={cn(
                    'grid w-full cursor-pointer grid-cols-[48px_minmax(0,1fr)] items-center gap-2.5 rounded-[10px] p-1.5 text-left hover:bg-card',
                    current && 'bg-card shadow-[inset_3px_0_0_var(--primary)]',
                  )}
                >
                  <RecordThumb node={n} size="md" />
                  <span className="min-w-0">
                    <span className="block text-sm leading-tight font-medium text-foreground">{n.label}</span>
                    {n.labelNe ? (
                      <span lang="ne" className="block font-devanagari text-xs text-foreground">
                        {n.labelNe}
                      </span>
                    ) : null}
                    <span className="block text-xs text-muted-foreground">
                      {words.typeLabel(n)}
                      {y != null ? ` · ${words.year(y)}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
