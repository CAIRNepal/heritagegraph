'use client';

/**
 * Global ⌘K / Ctrl-K command palette — fast keyboard-first navigation and
 * quick actions across HeritageGraph. Mounted once in the dashboard layout.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  IconLayoutDashboard,
  IconGraph,
  IconWorld,
  IconBuildingMonument,
  IconPlus,
  IconTrophy,
  IconMedal,
  IconUsers,
  IconListCheck,
  IconInfoCircle,
  IconSearch,
  IconSparkles,
} from '@tabler/icons-react';

import { useChatStore } from '@/lib/chat/useChatStore';
import { getPublicApiUrl } from '@/lib/api-base';

// universal_search returns results grouped by plural key; the detail route is
// /knowledge/<singular-domain>/view/<id>.
const DOMAIN_MAP: Record<string, string> = {
  persons: 'person',
  locations: 'location',
  events: 'event',
  traditions: 'tradition',
  deities: 'deity',
  guthis: 'guthi',
  structures: 'structure',
  rituals: 'ritual',
  festivals: 'festival',
  monuments: 'monument',
};

type EntityHit = { id: string; label: string; domain: string; type: string };

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

type Entry = { label: string; href: string; icon: React.ComponentType<{ className?: string }>; keywords?: string };

const NAVIGATE: Entry[] = [
  { label: 'Dashboard', href: '/', icon: IconLayoutDashboard, keywords: 'home' },
  { label: 'About', href: '/about', icon: IconInfoCircle, keywords: 'discover explore help info mission cair' },
  { label: 'Graph Visualization', href: '/graphview', icon: IconGraph, keywords: 'knowledge graph network' },
  { label: 'Heritage Atlas', href: '/atlas', icon: IconWorld, keywords: 'map globe geography' },
  { label: 'Heritage Museum', href: '/heritage-museum', icon: IconBuildingMonument, keywords: 'explore stories live kg immersive xr 3d vr' },
  { label: 'Leaderboard', href: '/leaderboard', icon: IconTrophy, keywords: 'ranking contributors' },
  { label: 'Progression', href: '/progression', icon: IconMedal, keywords: 'badges achievements' },
  { label: 'Contributors', href: '/community/contributors', icon: IconUsers, keywords: 'community people' },
  { label: 'Review Workspace', href: '/review', icon: IconListCheck, keywords: 'curation moderate' },
  { label: 'Methods & data', href: '/methods', icon: IconInfoCircle, keywords: 'provenance sparql citation nature reproducibility' },
];

const CONTRIBUTE: Entry[] = [
  { label: 'Contribute (hub)', href: '/contribute', icon: IconPlus, keywords: 'add new entity' },
  { label: 'New Cultural Entity', href: '/contribute/cultural-entity', icon: IconPlus, keywords: 'monument deity festival' },
  { label: 'New Project', href: '/contribute/projects/new', icon: IconPlus, keywords: 'project' },
  { label: 'Propose a Relationship', href: '/contribute/relationship-proposal', icon: IconPlus, keywords: 'edge link predicate' },
];

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [hits, setHits] = React.useState<EntityHit[]>([]);
  const toggleChat = useChatStore((s) => s.toggle);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Reset transient state when the palette closes.
  React.useEffect(() => {
    if (!open) {
      setQuery('');
      setHits([]);
    }
  }, [open]);

  // Debounced entity search across the knowledge graph (universal_search).
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${getPublicApiUrl()}/api/v1/cidoc/search/?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal, headers: { Accept: 'application/json' } },
        );
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, Array<Record<string, unknown>>>;
        const out: EntityHit[] = [];
        for (const [groupKey, rows] of Object.entries(data)) {
          const domain = DOMAIN_MAP[groupKey];
          if (!domain || !Array.isArray(rows)) continue;
          for (const r of rows.slice(0, 6)) {
            const id = r.id != null ? String(r.id) : '';
            const label = (r.name as string) || (r.title as string) || `${domain} #${id}`;
            if (id) out.push({ id, label, domain, type: domain });
          }
        }
        setHits(out.slice(0, 24));
      } catch {
        /* aborted or network error — ignore */
      }
    }, 220);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const render = (entries: Entry[]) =>
    entries.map((e) => {
      const Icon = e.icon;
      return (
        <CommandItem key={e.href} value={`${e.label} ${e.keywords ?? ''}`} onSelect={() => go(e.href)}>
          <Icon className="text-muted-foreground" />
          <span>{e.label}</span>
        </CommandItem>
      );
    });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search entities, pages, actions…  (try 'temple', 'museum')"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {hits.length > 0 && (
          <>
            <CommandGroup heading="Entities">
              {hits.map((h) => (
                <CommandItem
                  key={`${h.domain}-${h.id}`}
                  value={`${h.label} ${query}`}
                  onSelect={() => go(`/knowledge/${h.domain}/view/${h.id}`)}
                >
                  <IconSearch className="text-muted-foreground" />
                  <span>{h.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground capitalize">{h.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Navigate">{render(NAVIGATE)}</CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Contribute">{render(CONTRIBUTE)}</CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Assistant">
          <CommandItem
            value="ask ai assistant chat help question"
            onSelect={() => {
              setOpen(false);
              toggleChat();
            }}
          >
            <IconSparkles className="text-muted-foreground" />
            <span>Ask the AI assistant</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** A header button that opens the palette and shows the ⌘K hint. */
export function CommandMenuTrigger() {
  const dispatch = React.useCallback(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    );
  }, []);
  return (
    <button
      type="button"
      onClick={dispatch}
      aria-label="Open search (Command or Control + K)"
      className="hidden sm:inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <IconSearch className="h-3.5 w-3.5" />
      <span>Search…</span>
      <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
    </button>
  );
}
