'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import {
  Search,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
  Landmark,
  PartyPopper,
  Sparkles,
  UserRound,
  Users,
  Flame,
  BookOpen,
  ImageIcon,
  Globe,
  MapPin,
  Filter,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { ChatContextProvider } from '@/providers/ChatContextProvider';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { PublicSiteHeader } from '@/components/public-site-header';
import { fetchPublicDiscovery, type DiscoveryResult } from '@/lib/api/discovery';
import {
  type DiscoveryCategory,
  DISCOVERY_CATEGORIES,
  FACET_VALLEYS,
} from '@/data/dummyDiscovery';
import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<
  DiscoveryCategory,
  ComponentType<{ className?: string; size?: number }>
> = {
  monuments: Landmark,
  festivals: PartyPopper,
  deities: Sparkles,
  persons: UserRound,
  guthis: Users,
  rituals: Flame,
};

function sortApiResults(
  list: DiscoveryResult[],
  sortBy: 'relevance' | 'title',
  dir: 'asc' | 'desc'
): DiscoveryResult[] {
  const next = [...list];
  if (sortBy === 'title') {
    next.sort((a, b) =>
      dir === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    );
  }
  return next;
}

function filterClientResults(
  results: DiscoveryResult[],
  opts: {
    facetHasImage: boolean | null;
    facetOnline: boolean | null;
    facetValley: string | null;
  }
): DiscoveryResult[] {
  let out = results;
  if (opts.facetHasImage === true) {
    out = out.filter((r) => r.has_media);
  }
  if (opts.facetOnline === true) {
    out = out.filter((r) => r.is_published !== false);
  }
  if (opts.facetValley) {
    const v = opts.facetValley.toLowerCase();
    out = out.filter((r) => r.location_hint?.toLowerCase().includes(v));
  }
  return out;
}

function FacetBlock({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border py-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-2 text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
      >
        {title}
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && <div className="pb-3 pl-0.5 text-sm">{children}</div>}
    </div>
  );
}

function ResultThumbnail({
  category,
}: {
  category: DiscoveryCategory;
}) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-border bg-muted/80">
      {category === 'persons' ? (
        <BookOpen className="h-7 w-7 text-muted-foreground" />
      ) : category === 'monuments' ? (
        <Landmark className="h-7 w-7 text-muted-foreground" />
      ) : (
        <BookOpen className="h-7 w-7 text-muted-foreground" />
      )}
    </div>
  );
}

export default function DiscoveryLandingPage() {
  const pathname = usePathname();
  const [activeCategory, setActiveCategory] =
    useState<DiscoveryCategory>('persons');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'relevance' | 'title'>('relevance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [facetHasImage, setFacetHasImage] = useState<boolean | null>(null);
  const [facetOnline, setFacetOnline] = useState<boolean | null>(null);
  const [facetValley, setFacetValley] = useState<string | null>(null);
  const [mobileFacetsOpen, setMobileFacetsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [rawResults, setRawResults] = useState<DiscoveryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetchPublicDiscovery(activeCategory, appliedQuery, { signal: ac.signal })
      .then((data) => {
        setCounts(data.counts ?? {});
        setRawResults(data.results ?? []);
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setError(e.message || 'Failed to load discovery data');
        setRawResults([]);
        setCounts({});
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [activeCategory, appliedQuery]);

  const filtered = useMemo(
    () =>
      filterClientResults(rawResults, {
        facetHasImage,
        facetOnline,
        facetValley,
      }),
    [rawResults, facetHasImage, facetOnline, facetValley]
  );

  const sorted = useMemo(
    () => sortApiResults(filtered, sortBy, sortDir),
    [filtered, sortBy, sortDir]
  );

  const meta = DISCOVERY_CATEGORIES.find((c) => c.id === activeCategory);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedQuery(query);
  };

  const facetPanel = (
    <>
      <FacetBlock title="Has digital representation" defaultOpen>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-muted-foreground hover:text-foreground">
          <input
            type="checkbox"
            checked={facetHasImage === true}
            onChange={() =>
              setFacetHasImage(facetHasImage === true ? null : true)
            }
            className="rounded border-border"
          />
          <ImageIcon className="h-3.5 w-3.5" />
          With image / media (when linked in graph)
        </label>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Few records expose media flags yet; this filter may return no rows until
          representations are published.
        </p>
      </FacetBlock>
      <FacetBlock title="Availability" defaultOpen>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-muted-foreground hover:text-foreground">
          <input
            type="checkbox"
            checked={facetOnline === true}
            onChange={() =>
              setFacetOnline(facetOnline === true ? null : true)
            }
            className="rounded border-border"
          />
          <Globe className="h-3.5 w-3.5" />
          Published (not draft / pending review)
        </label>
      </FacetBlock>
      <FacetBlock title="Region / valley">
        <div className="flex flex-col gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setFacetValley(null)}
            className={cn(
              'text-left text-xs hover:text-primary',
              !facetValley && 'font-medium text-primary'
            )}
          >
            Any region
          </button>
          {FACET_VALLEYS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFacetValley(v)}
              className={cn(
                'flex items-center gap-1.5 text-left text-xs hover:text-primary',
                facetValley === v && 'font-medium text-primary'
              )}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              {v}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Matches text in the record&apos;s location field from the API.
        </p>
      </FacetBlock>
      <FacetBlock title="Record type">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Use the category tabs above to switch entity type. Results load from the
          HeritageGraph CIDOC API.
        </p>
      </FacetBlock>
    </>
  );

  return (
    <ChatContextProvider value={{ surface: 'public', currentPath: pathname }}>
      <div className="min-h-screen bg-background text-foreground">
        <PublicSiteHeader variant="marketing" />

        <div className="border-b border-border bg-muted/40 dark:bg-muted/20">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search monuments, festivals, persons, deities…"
                className="h-14 w-full rounded-full border border-border bg-card pr-14 pl-5 text-base text-foreground shadow-sm outline-none ring-primary/20 transition-shadow focus:border-primary focus:ring-2 dark:bg-card"
                aria-label="Search collections"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
                aria-label="Submit search"
              >
                <Search className="h-5 w-5" />
              </button>
            </form>
            <div className="mt-2 flex flex-wrap items-center justify-end gap-3 text-sm">
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="text-primary hover:underline underline-offset-2"
              >
                {advancedOpen
                  ? 'Hide search tips'
                  : 'Show search tips'}
              </button>
            </div>
            {advancedOpen && (
              <p
                id="search-tips"
                className="mt-4 rounded-lg border border-dashed border-border bg-card/80 p-4 text-sm text-muted-foreground"
              >
                <strong className="text-foreground">Search tips:</strong> Search
                runs across names, descriptions, notes, and location fields for the
                selected category. Leave the box empty to browse the most recent
                records. Open a result for the full public record page.
              </p>
            )}
          </div>
        </div>

        <div className="border-b border-border bg-muted/30 dark:bg-muted/10">
          <div className="mx-auto max-w-[1400px] px-3 py-3 sm:px-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {DISCOVERY_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id];
                const count = counts[cat.id] ?? 0;
                const active = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      'flex flex-col rounded-lg border px-3 py-3 text-left transition-all',
                      active
                        ? 'border-t-[3px] border-t-primary border-x-border border-b-border bg-card shadow-sm dark:border-x-border dark:border-b-border'
                        : 'border-transparent bg-muted/60 hover:bg-muted dark:bg-muted/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          active ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {cat.shortLabel}
                      </span>
                      <Icon
                        className={cn(
                          'h-5 w-5 shrink-0',
                          active ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                    </div>
                    <span className="mt-1.5 text-xs text-muted-foreground">
                      {count} {count === 1 ? 'match' : 'matches'}
                      {appliedQuery.trim() ? ' (for this query)' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1400px] px-3 py-5 sm:px-4 lg:py-6">
          {error ? (
            <div
              className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Could not reach the API</p>
                <p className="mt-1 text-destructive/90">{error}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ensure the Django backend is running and{' '}
                  <code className="rounded bg-muted px-1 text-foreground">
                    NEXT_PUBLIC_API_URL
                  </code>{' '}
                  points to it (see <code className="rounded bg-muted px-1">.env.example</code>
                  ).
                </p>
              </div>
            </div>
          ) : null}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground sm:text-xl">
                {loading ? '…' : sorted.length}{' '}
                {meta?.label ?? 'Entity'} results
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {meta?.description}{' '}
                {appliedQuery.trim()
                  ? `Filtered by “${appliedQuery.trim()}”.`
                  : 'Showing recent records.'}{' '}
                Click a row for the public detail page.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setViewMode(viewMode === 'list' ? 'grid' : 'list')
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
              >
                {viewMode === 'list' ? (
                  <>
                    <LayoutGrid className="h-4 w-4" />
                    Grid view
                  </>
                ) : (
                  <>
                    <List className="h-4 w-4" />
                    List view
                  </>
                )}
              </button>
              <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="sr-only sm:not-sr-only sm:inline">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as 'relevance' | 'title')
                  }
                  className="rounded-md border border-border bg-card px-2 py-1.5 text-foreground"
                >
                  <option value="relevance">Relevance</option>
                  <option value="title">Title</option>
                </select>
              </label>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                className="rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2 text-sm font-medium text-foreground lg:hidden"
            onClick={() => setMobileFacetsOpen(!mobileFacetsOpen)}
          >
            <Filter className="h-4 w-4" />
            {mobileFacetsOpen ? 'Hide filters' : 'Show filters'}
          </button>

          <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
            <aside
              className={cn(
                'lg:w-60 lg:shrink-0',
                mobileFacetsOpen ? 'block' : 'hidden lg:block'
              )}
            >
              <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Refine results
                </p>
                {facetPanel}
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-20 text-muted-foreground">
                  <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
                  Loading from API…
                </div>
              ) : sorted.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center text-muted-foreground">
                  No records match this category, query, or filters. Try another tab,
                  clear the search, or relax filters.
                </div>
              ) : viewMode === 'list' ? (
                <ul className="divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
                  {sorted.map((result) => (
                    <li key={`${result.resource}-${result.id}`}>
                      <Link
                        href={`/view/${result.resource}/${encodeURIComponent(result.id)}`}
                        className="flex gap-4 p-4 transition-colors hover:bg-muted/40"
                      >
                        <ResultThumbnail category={activeCategory} />
                        <div className="min-w-0 flex-1">
                          <h2 className="text-base font-semibold text-primary hover:underline sm:text-lg">
                            {result.name}
                          </h2>
                          {result.summary ? (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {result.summary}
                            </p>
                          ) : null}
                          <dl className="mt-2 space-y-1 text-sm">
                            <div className="flex flex-wrap gap-x-2">
                              <dt className="text-muted-foreground">Type</dt>
                              <dd>
                                <span className="text-primary">{result.type}</span>
                              </dd>
                            </div>
                            {result.location_hint ? (
                              <div className="flex flex-wrap gap-x-2">
                                <dt className="text-muted-foreground">Location</dt>
                                <dd className="text-foreground">
                                  {result.location_hint}
                                </dd>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-x-2">
                              <dt className="text-muted-foreground">Identifier</dt>
                              <dd className="font-mono text-xs text-foreground">
                                {result.resource}/{result.id}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {sorted.map((result) => (
                    <li key={`${result.resource}-${result.id}`}>
                      <Link
                        href={`/view/${result.resource}/${encodeURIComponent(result.id)}`}
                        className="flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="mb-3 flex justify-center">
                          <ResultThumbnail category={activeCategory} />
                        </div>
                        <h2 className="line-clamp-3 text-center text-sm font-semibold text-primary hover:underline">
                          {result.name}
                        </h2>
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                          {result.resource}/{result.id}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <footer className="border-t border-border bg-muted/30 py-6 text-center text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} HeritageGraph · CAIR-Nepal · Public
            discovery via{' '}
            <code className="rounded bg-muted px-1 text-foreground">
              GET /cidoc/discovery/
            </code>
          </p>
        </footer>
      </div>

      <ChatWidget />
    </ChatContextProvider>
  );
}
