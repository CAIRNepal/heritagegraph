'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark,
  ChevronRight,
  ChevronsLeft,
  Compass,
  Eye,
  EyeOff,
  History,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { AtlasEntity } from '@/types/atlas';
import { ONTOLOGY_CLASSES } from '@/types/atlas';

import { useAtlasStore, useFilteredAtlasEntities } from '../../hooks/use-atlas-store';
import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import { ATLAS_GLASS } from '../../lib/atlas-format';
import { MARKER_ARCHETYPES, type AtlasMarkerStyle } from '../HeritageGlobe/marker-config';

interface ExplorerSidebarProps {
  onPlayJourney: () => void;
}

const CATEGORY_PREVIEW_LIMIT = 14;

function CategoryRow({
  style,
  count,
  enabled,
  expanded,
  members,
  onToggleVisibility,
  onToggleExpanded,
  onSelectEntity,
}: {
  style: AtlasMarkerStyle;
  count: number;
  enabled: boolean;
  expanded: boolean;
  members: AtlasEntity[];
  onToggleVisibility: () => void;
  onToggleExpanded: () => void;
  onSelectEntity: (id: string) => void;
}) {
  return (
    <div className="rounded-xl">
      <div
        className={cn(
          'group flex w-full items-center gap-1 rounded-xl text-[13px] transition-colors',
          enabled ? 'text-foreground' : 'text-muted-foreground/50',
        )}
      >
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-controls={`atlas-category-${style.id}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-muted/50"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-90',
            )}
            strokeWidth={1.75}
            aria-hidden
          />
          <span
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full transition-all',
              enabled ? 'scale-100' : 'scale-75 opacity-30',
            )}
            style={{
              backgroundColor: style.color,
              boxShadow: enabled ? `0 0 8px ${style.color}88` : 'none',
            }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate font-medium">{style.label}</span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">{count}</span>
        </button>
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-pressed={enabled}
          aria-label={enabled ? `Hide ${style.label} on the globe` : `Show ${style.label} on the globe`}
          title={enabled ? 'Hide on globe' : 'Show on globe'}
          className="mr-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        >
          {enabled ? (
            <Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          ) : (
            <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          )}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={`atlas-category-${style.id}`}
            key={`${style.id}-members`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <ul className="mb-1 ml-3 space-y-0.5 border-l border-border/50 pl-2.5">
              {members.length === 0 ? (
                <li className="px-2 py-1 text-[11px] text-muted-foreground/70">No sites in this category</li>
              ) : (
                members.map((entity) => (
                  <li key={entity.id}>
                    <button
                      type="button"
                      onClick={() => onSelectEntity(entity.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[12px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    >
                      <span className="min-w-0 flex-1 truncate">{entity.name}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground/55">{entity.class}</span>
                    </button>
                  </li>
                ))
              )}
              {count > members.length ? (
                <li className="px-2 py-0.5 text-[10px] text-muted-foreground/60">
                  +{count - members.length} more — use search
                </li>
              ) : null}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * Left explorer column: search, journeys, category toggles, bookmarks and
 * recently viewed. Collapses into a floating compass button.
 */
export function ExplorerSidebar({ onPlayJourney }: ExplorerSidebarProps) {
  const entities = useFilteredAtlasEntities();
  const allEntities = useAtlasStore((s) => s.entities);
  const classEnabled = useAtlasStore((s) => s.classEnabled);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const getEntityById = useAtlasStore((s) => s.getEntityById);
  const dataSource = useAtlasStore((s) => s.dataSource);
  const corpusStatus = useAtlasStore((s) => s.corpusStatus);
  const corpusError = useAtlasStore((s) => s.corpusError);
  const setDataSource = useAtlasStore((s) => s.setDataSource);

  const explorerOpen = useAtlasUiStore((s) => s.explorerOpen);
  const setExplorerOpen = useAtlasUiStore((s) => s.setExplorerOpen);
  const setSpotlightOpen = useAtlasUiStore((s) => s.setSpotlightOpen);
  const setFiltersOpen = useAtlasUiStore((s) => s.setFiltersOpen);
  const filtersOpen = useAtlasUiStore((s) => s.filtersOpen);
  const bookmarkIds = useAtlasUiStore((s) => s.bookmarkIds);
  const recentIds = useAtlasUiStore((s) => s.recentIds);

  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const countsByArchetype = useMemo(() => {
    const counts = new Map<string, number>();
    for (const style of MARKER_ARCHETYPES) counts.set(style.id, 0);
    for (const e of allEntities) {
      for (const style of MARKER_ARCHETYPES) {
        if (style.classes.includes(e.class)) {
          counts.set(style.id, (counts.get(style.id) ?? 0) + 1);
          break;
        }
      }
    }
    return counts;
  }, [allEntities]);

  const membersByArchetype = useMemo(() => {
    const map = new Map<string, AtlasEntity[]>();
    for (const style of MARKER_ARCHETYPES) {
      const members = allEntities
        .filter((e) => style.classes.includes(e.class))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, CATEGORY_PREVIEW_LIMIT);
      map.set(style.id, members);
    }
    return map;
  }, [allEntities]);

  const archetypeEnabled = (style: AtlasMarkerStyle) =>
    style.classes.some((c) => classEnabled[c]);

  const toggleArchetype = (style: AtlasMarkerStyle) => {
    const next = { ...useAtlasStore.getState().classEnabled };
    const target = !archetypeEnabled(style);
    for (const c of style.classes) next[c] = target;
    // Never allow zero visible classes.
    if (ONTOLOGY_CLASSES.every((c) => !next[c])) {
      for (const c of ONTOLOGY_CLASSES) next[c] = true;
    }
    useAtlasStore.setState({ classEnabled: next });
  };

  const bookmarks = bookmarkIds
    .map((id) => getEntityById(id))
    .filter((e): e is NonNullable<typeof e> => e != null)
    .slice(0, 6);
  const recents = recentIds
    .map((id) => getEntityById(id))
    .filter((e): e is NonNullable<typeof e> => e != null)
    .slice(0, 5);

  return (
    <>
      <AnimatePresence>
        {!explorerOpen ? (
          <motion.div
            key="explorer-fab"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="pointer-events-auto absolute left-4 top-4 z-30"
          >
            <Button
              type="button"
              size="icon"
              aria-label="Open explorer"
              className={cn(ATLAS_GLASS, 'h-11 w-11 rounded-2xl bg-background/70 text-foreground hover:bg-background/90')}
              variant="ghost"
              onClick={() => setExplorerOpen(true)}
            >
              <Compass className="h-5 w-5" strokeWidth={1.5} />
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {explorerOpen ? (
          <motion.aside
            key="explorer"
            initial={{ opacity: 0, x: -28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            aria-label="Explorer"
            className={cn(
              ATLAS_GLASS,
              'pointer-events-auto absolute bottom-28 left-4 top-4 z-30 hidden w-[288px] flex-col overflow-hidden md:flex',
            )}
          >
            <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-4">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Heritage Atlas</h2>
                <p className="text-[11px] text-muted-foreground">
                  {entities.length.toLocaleString()} sites ·{' '}
                  <button
                    type="button"
                    className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                    onClick={() => setDataSource(dataSource === 'live' ? 'demo' : 'live')}
                  >
                    {dataSource === 'live' ? 'live graph' : 'demo corpus'}
                  </button>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Collapse explorer"
                className="h-8 w-8 rounded-xl text-muted-foreground"
                onClick={() => setExplorerOpen(false)}
              >
                <ChevronsLeft className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </div>

            <div className="shrink-0 space-y-2 px-3">
              <button
                type="button"
                onClick={() => setSpotlightOpen(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              >
                <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span className="flex-1">Search heritage…</span>
                <kbd className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px]">
                  ⌘K
                </kbd>
              </button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 flex-1 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90"
                  onClick={onPlayJourney}
                >
                  <Play className="mr-1.5 h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
                  Play Journey
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={filtersOpen}
                  className={cn(
                    'h-9 rounded-xl border border-border/50 bg-muted/40 px-3',
                    filtersOpen && 'bg-primary/15 text-primary',
                  )}
                  onClick={() => setFiltersOpen(!filtersOpen)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="sr-only">Filters</span>
                </Button>
              </div>
            </div>

            {corpusStatus === 'loading' ? (
              <p className="mx-4 mt-2 shrink-0 animate-pulse text-[11px] text-muted-foreground">
                Loading the knowledge graph…
              </p>
            ) : null}
            {corpusStatus === 'error' && corpusError ? (
              <p className="mx-4 mt-2 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-300">
                {corpusError}
              </p>
            ) : null}

            {/* Explicit height chain so Radix ScrollArea can expand inside the flex column. */}
            <div className="mt-3 min-h-0 flex-1 overflow-hidden px-3">
              <ScrollArea className="h-full">
                <div className="space-y-4 pb-4 pr-2">
                  <section aria-label="Categories">
                    <h3 className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      <Sparkles className="h-3 w-3" strokeWidth={1.5} /> Categories
                    </h3>
                    <div className="space-y-0.5">
                      {MARKER_ARCHETYPES.map((style) => (
                        <CategoryRow
                          key={style.id}
                          style={style}
                          count={countsByArchetype.get(style.id) ?? 0}
                          enabled={archetypeEnabled(style)}
                          expanded={expandedCategoryId === style.id}
                          members={membersByArchetype.get(style.id) ?? []}
                          onToggleVisibility={() => toggleArchetype(style)}
                          onToggleExpanded={() =>
                            setExpandedCategoryId((prev) => (prev === style.id ? null : style.id))
                          }
                          onSelectEntity={(id) => selectEntity(id)}
                        />
                      ))}
                    </div>
                  </section>

                  {bookmarks.length > 0 ? (
                    <section aria-label="Bookmarks">
                      <h3 className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                        <Bookmark className="h-3 w-3" strokeWidth={1.5} /> Bookmarks
                      </h3>
                      <div className="space-y-0.5">
                        {bookmarks.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => selectEntity(e.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] hover:bg-muted/50"
                          >
                            <span className="min-w-0 flex-1 truncate">{e.name}</span>
                            <span className="text-[10px] text-muted-foreground/60">{e.class}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {recents.length > 0 ? (
                    <section aria-label="Recently viewed">
                      <h3 className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                        <History className="h-3 w-3" strokeWidth={1.5} /> Recently viewed
                      </h3>
                      <div className="space-y-0.5">
                        {recents.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => selectEntity(e.id)}
                            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          >
                            <span className="min-w-0 flex-1 truncate">{e.name}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              </ScrollArea>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}
