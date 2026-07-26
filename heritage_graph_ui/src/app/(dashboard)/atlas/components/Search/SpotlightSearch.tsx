'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import { ATLAS_ERA_LABELS, centuryLabel } from '../../lib/atlas-format';
import { markerStyleForEntity, MARKER_ARCHETYPES } from '../HeritageGlobe/marker-config';

const MAX_RESULTS = 24;

/**
 * Spotlight-style global search (⌘K): entities, places, festivals, people —
 * with thumbnails and instant fly-to on selection.
 */
export function SpotlightSearch() {
  const open = useAtlasUiStore((s) => s.spotlightOpen);
  const setOpen = useAtlasUiStore((s) => s.setSpotlightOpen);
  const entities = useAtlasStore((s) => s.entities);
  const selectEntity = useAtlasStore((s) => s.selectEntity);

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Curated defaults: one showcase entity per category.
      const picks: typeof entities = [];
      for (const style of MARKER_ARCHETYPES) {
        const hit = entities.find(
          (e) => style.classes.includes(e.class) && e.imageUrl && e.lat != null,
        ) ?? entities.find((e) => style.classes.includes(e.class));
        if (hit && !picks.includes(hit)) picks.push(hit);
      }
      return picks.slice(0, 8);
    }
    const scored = entities
      .map((e) => {
        const name = e.name.toLowerCase();
        const alt = `${e.nameNe ?? ''} ${e.class} ${e.era} ${e.summary}`.toLowerCase();
        let score = -1;
        if (name.startsWith(q)) score = 3;
        else if (name.includes(q)) score = 2;
        else if (alt.includes(q)) score = 1;
        return { e, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
    return scored.slice(0, MAX_RESULTS).map((r) => r.e);
  }, [entities, query]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="spotlight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 z-[60] flex items-start justify-center bg-black/45 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="w-[min(620px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/40 bg-background/85 shadow-2xl shadow-black/40 backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Command shouldFilter={false} className="bg-transparent">
              <div className="flex items-center gap-2.5 border-b border-border/40 px-4">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search temples, festivals, people, dynasties…"
                  className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/60"
                  aria-label="Search heritage entities"
                />
                <kbd className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  esc
                </kbd>
              </div>
              <CommandList className="max-h-[52vh]">
                <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
                  No heritage found for “{query}”.
                </CommandEmpty>
                <CommandGroup heading={query ? 'Results' : 'Explore'}>
                  {results.map((e) => {
                    const style = markerStyleForEntity(e);
                    const century = centuryLabel(e.foundedYear);
                    return (
                      <CommandItem
                        key={e.id}
                        value={e.id}
                        onSelect={() => {
                          setOpen(false);
                          selectEntity(e.id);
                        }}
                        className="gap-3 rounded-xl px-2.5 py-2"
                      >
                        {e.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote KG media
                          <img
                            src={e.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-9 w-9 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${style.color}22` }}
                          >
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: style.color }}
                            />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{e.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {e.class} · {ATLAS_ERA_LABELS[e.era]}
                            {century ? ` · ${century}` : ''}
                          </span>
                        </span>
                        {e.lat != null && e.lon != null ? (
                          <span className="shrink-0 text-[10px] text-muted-foreground/60">fly to ↵</span>
                        ) : (
                          <span className="shrink-0 text-[10px] text-muted-foreground/60">open ↵</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
