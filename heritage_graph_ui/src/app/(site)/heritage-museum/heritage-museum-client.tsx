'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IconX } from '@tabler/icons-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { attachRelations, kgNeighborhoodToGraph } from '@/lib/heritage-museum/live-graph';
import { enrichMuseumGraph } from '@/lib/heritage-museum/museum-graph';
import { API_BASE, useHeritageCollection } from '@/lib/heritage-museum/use-heritage-collection';
import { fetchKgNeighborhood } from '@/lib/kg-graph';
import { downloadJson } from '@/lib/provenance';

import { NODE_TYPE_CONFIG, type GraphData, type GraphLink, type GraphNode, type HgCategory } from './heritage-data';
import { MandalaLoader } from './components/MandalaLoader';
import { CollectionRail } from './components/exhibit/CollectionRail';
import { ContextColumn, type LensKind } from './components/exhibit/ContextColumn';
import { ExhibitView } from './components/exhibit/ExhibitView';
import { connectionsOf } from './components/exhibit/exhibit-utils';
import { MuseumLens } from './components/exhibit/MuseumLens';
import { RailControls } from './components/exhibit/RailControls';
import { exportVisibleGraphPayload } from './utils/exportGraph';

// ══════════════════════════════════════════════════════════════════════════════
/** The context column sits beside the exhibit from this width; below it, under it. */
const WIDE_QUERY = '(min-width: 1280px)';
/** The collection rail is a column from this width; below it, a sheet. */
const RAIL_QUERY = '(min-width: 1024px)';
const EMPTY: GraphData = { nodes: [], links: [] };

/** Lens ↔ `?view=`. Old links used 2d (graph) and map; xr (stories) is now the default page. */
const VIEW_FOR_LENS: Record<LensKind, string> = { map: 'map', graph: '2d', timeline: 'timeline' };
const LENS_FOR_VIEW: Record<string, LensKind> = { map: 'map', '2d': 'graph', timeline: 'timeline' };

/**
 * The Heritage Museum: one exhibit page.
 *
 * It used to be three modes — Stories, Map, Connections — and switching lost
 * the reader's place. Now the record stays in the middle, the collection is a
 * list beside it, and its place, date and connections sit alongside; the full
 * map, the timeline and a focused graph open as overlays when wanted.
 */
export function HeritageMindMapClient() {
  const { data: session } = useSession();
  const t = useTranslations('heritageMuseum');
  const tx = useTranslations('heritageMuseum.exhibit');
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrappedRef = useRef(false);
  const wide = useMediaQuery(WIDE_QUERY);
  const railColumn = useMediaQuery(RAIL_QUERY);

  const collection = useHeritageCollection();
  const { source: dataSource, graph: fullGraph, loading, error, liveLoading, liveError, liveGraph, setLiveGraph, retryLive: retryLiveData, datasetMeta } = { ...collection, liveGraph: collection.source === 'live' ? collection.graph : null };

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kind, setKind] = useState<HgCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [lens, setLens] = useState<LensKind | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const exhibitScrollRef = useRef<HTMLDivElement>(null);

  const toggleDataSource = useCallback(() => {
    if (collection.switchTo(dataSource === 'demo' ? 'live' : 'demo')) {
      setSelectedId(null);
      setLens(null);
    }
  }, [collection, dataSource]);

  // ── Bootstrap from the URL ─────────────────────────────────────────────────
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const view = searchParams.get('view');
    if (view && LENS_FOR_VIEW[view]) setLens(LENS_FOR_VIEW[view]);
    const node = searchParams.get('node');
    if (node) setSelectedId(decodeURIComponent(node));
    // The illustrated corpus is self-contained and always renders, so it is the
    // default; the live graph loads only when the URL or the visitor asks.
    if (searchParams.get('source') === 'live') collection.switchTo('live');
    // Runs once; the collection is stable enough for a one-shot read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Click-to-expand (live KG only) ─────────────────────────────────────────

  const expandNode = useCallback(
    async (node: GraphNode) => {
      if (dataSource !== 'live' || !API_BASE) return;
      setExpanding(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const token = (session as any)?.accessToken as string | undefined;
        const resp = await fetchKgNeighborhood(API_BASE, node.id, token, { includeLux: 'linked' });
        const add = kgNeighborhoodToGraph(node.id, resp);
        const base = liveGraph ?? EMPTY;
        const nodeIds = new Set(base.nodes.map((n) => n.id));
        const newNodes = add.nodes.filter((n) => !nodeIds.has(n.id));
        const idOf = (x: string | GraphNode) => (typeof x === 'string' ? x : x.id);
        const linkKey = (l: GraphLink) => `${idOf(l.source)}→${idOf(l.target)}→${l.predicate}`;
        const seenLinks = new Set(base.links.map(linkKey));
        const newLinks = add.links.filter((l) => !seenLinks.has(linkKey(l)));
        if (!newNodes.length && !newLinks.length) {
          toast(t('expand.none', { name: node.label }));
          return;
        }
        setLiveGraph((prev) => {
          const current = prev ?? EMPTY;
          const have = new Set(current.nodes.map((n) => n.id));
          const haveLinks = new Set(current.links.map(linkKey));
          const nodes = [...current.nodes, ...newNodes.filter((n) => !have.has(n.id))];
          const links = [...current.links, ...newLinks.filter((l) => !haveLinks.has(linkKey(l)))];
          attachRelations(nodes, links);
          enrichMuseumGraph({ nodes, links });
          return { nodes, links };
        });
        toast.success(t('expand.added', { count: newNodes.length, name: node.label }));
      } catch (err) {
        console.error('heritage-museum: expand failed', err);
        toast.error(t('expand.failed', { name: node.label }));
      } finally {
        setExpanding(false);
      }
    },
    [dataSource, session, liveGraph, setLiveGraph, t],
  );

  // ── The collection, as listed ──────────────────────────────────────────────
  const visibleNodes = useMemo<GraphNode[]>(() => {
    if (!fullGraph) return [];
    const q = searchQuery.trim().toLowerCase();
    return fullGraph.nodes
      .filter((n) => {
        if (kind && n.hgCategory !== kind) return false;
        if (!q) return true;
        return (
          n.label.toLowerCase().includes(q) ||
          (n.description ?? '').toLowerCase().includes(q) ||
          (NODE_TYPE_CONFIG[n.nodeType]?.label ?? '').toLowerCase().includes(q) ||
          Boolean(n.tags?.some((tag) => tag.toLowerCase().includes(q)))
        );
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [fullGraph, kind, searchQuery]);

  // The open record: the one asked for, else the first listed record that has
  // a photograph, so the page never opens on an empty exhibit.
  const selectedNode = useMemo<GraphNode | null>(() => {
    if (!fullGraph?.nodes.length) return null;
    const asked = selectedId ? fullGraph.nodes.find((n) => n.id === selectedId) : undefined;
    if (asked) return asked;
    const sorted = [...fullGraph.nodes].sort((a, b) => a.label.localeCompare(b.label));
    return sorted.find((n) => n.imageUrl || n.images?.length) ?? sorted[0];
  }, [fullGraph, selectedId]);

  const connections = useMemo(
    () => (selectedNode && fullGraph ? connectionsOf(selectedNode, fullGraph) : []),
    [selectedNode, fullGraph],
  );

  const select = useCallback((node: GraphNode) => {
    setSelectedId(node.id);
    setRailOpen(false);
    exhibitScrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const index = selectedNode ? visibleNodes.findIndex((n) => n.id === selectedNode.id) : -1;
  const prev = index > 0 ? visibleNodes[index - 1] : null;
  const next = index >= 0 && index < visibleNodes.length - 1 ? visibleNodes[index + 1] : null;

  // ←/→ step through the list when focus is not in a field or the list itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lens || railOpen || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], ul')) return;
      if (e.key === 'ArrowRight' && next) select(next);
      if (e.key === 'ArrowLeft' && prev) select(prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lens, railOpen, next, prev, select]);

  // ── State → URL, for citable links ─────────────────────────────────────────
  useEffect(() => {
    if (!bootstrappedRef.current || !selectedNode) return;
    const p = new URLSearchParams();
    p.set('source', dataSource);
    p.set('node', selectedNode.id);
    if (lens) p.set('view', VIEW_FOR_LENS[lens]);
    const target = `/heritage-museum?${p.toString()}`;
    if (target !== `/heritage-museum?${searchParams.toString()}`) router.replace(target, { scroll: false });
  }, [dataSource, selectedNode, lens, router, searchParams]);

  const handleExportJson = useCallback(() => {
    if (!fullGraph) return;
    const ids = new Set(visibleNodes.map((n) => n.id));
    const graph = {
      nodes: visibleNodes,
      links: fullGraph.links.filter((l) => ids.has(typeof l.source === 'string' ? l.source : l.source.id) && ids.has(typeof l.target === 'string' ? l.target : l.target.id)),
    };
    downloadJson(
      `heritagegraph-museum-${dataSource}-${new Date().toISOString().slice(0, 10)}.json`,
      exportVisibleGraphPayload(graph, datasetMeta, dataSource),
    );
  }, [fullGraph, visibleNodes, datasetMeta, dataSource]);

  // Visitor-facing only; configuration detail goes to the console where loading fails.
  const messageFor = (e: string | null) =>
    e === 'unconfigured' || e === 'notfound'
      ? t('errors.liveUnavailable')
      : e === 'timeout'
        ? t('errors.liveTimeout')
        : e === 'live'
          ? t('errors.liveLoad')
          : e === 'demo'
            ? t('errors.demoLoad')
            : null;
  const liveRetryable = liveError === 'timeout' || liveError === 'live';
  const sparseLive = dataSource === 'live' && !liveLoading && !liveError && liveGraph && liveGraph.nodes.length < 20;

  const rail = (
    <CollectionRail
      allNodes={fullGraph?.nodes ?? []}
      visibleNodes={visibleNodes}
      selectedId={selectedNode?.id ?? null}
      onSelect={select}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      kind={kind}
      onKindChange={setKind}
      showTitle={railColumn}
      controls={
        <RailControls
          dataSource={dataSource}
          demoCount={collection.demoCount}
          liveLoading={liveLoading}
          onSwitchSource={toggleDataSource}
          provenance={dataSource === 'demo' ? collection.demoProvenance : null}
          liveApiBase={dataSource === 'live' ? API_BASE : null}
          datasetMeta={dataSource === 'live' ? datasetMeta : null}
          onExportJson={dataSource === 'live' ? handleExportJson : undefined}
        />
      }
    />
  );

  const context =
    selectedNode && fullGraph ? (
      <ContextColumn
        node={selectedNode}
        allNodes={fullGraph.nodes}
        connections={connections}
        onSelect={select}
        onOpenLens={setLens}
        showProvenance={dataSource === 'live'}
      />
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {liveError && (
        <div className="z-20 flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{messageFor(liveError)}</span>
          <span className="ml-auto flex items-center gap-2">
            {liveRetryable && (
              <Button onClick={retryLiveData} disabled={liveLoading} variant="outline" size="sm" className="h-7 text-xs" type="button">
                {liveLoading ? t('errors.retrying') : t('errors.retry')}
              </Button>
            )}
            {dataSource === 'live' && (
              <Button onClick={toggleDataSource} variant="outline" size="sm" className="h-7 text-xs" type="button">
                {t('errors.showDemo')}
              </Button>
            )}
            <Button onClick={collection.dismissLiveError} variant="ghost" size="icon" className="size-7" aria-label={t('errors.dismiss')} type="button">
              <IconX className="size-4" />
            </Button>
          </span>
        </div>
      )}

      {sparseLive ? (
        <div className="z-20 flex-shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground" role="status">
          {t('sparseLive', { count: liveGraph.nodes.length })}{' '}
          <Link href="/contribute/entity" className="text-primary underline underline-offset-2">
            {t('sparseLiveContribute')}
          </Link>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_330px]">
        {railColumn ? <aside aria-label={tx('browseCollection')} className="min-h-0 border-r border-border">{rail}</aside> : null}

        <div ref={exhibitScrollRef} className="min-h-0 overflow-auto">
          {!railColumn ? (
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5">
              <h1 className="font-serif text-xl leading-tight">{t('title')}</h1>
              <Button type="button" variant="outline" size="sm" onClick={() => setRailOpen(true)}>
                {tx('browseCollection')}
              </Button>
            </div>
          ) : null}

          <div className="px-4 pt-5 pb-12 sm:px-6 lg:px-[clamp(1.25rem,3vw,2.75rem)] lg:pt-7">
            {loading ? (
              <div className="grid min-h-[50vh] place-items-center">
                <MandalaLoader />
              </div>
            ) : error && !fullGraph ? (
              <div className="grid min-h-[50vh] place-items-center" role="alert">
                <div className="grid max-w-md justify-items-center gap-3 p-8 text-center">
                  <p className="text-sm font-medium text-foreground">{t('errors.loadTitle')}</p>
                  <p className="text-xs text-muted-foreground">{messageFor(error)}</p>
                  {dataSource === 'live' ? (
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      {liveRetryable ? (
                        <Button onClick={retryLiveData} disabled={liveLoading} variant="outline" size="sm" type="button">
                          {liveLoading ? t('errors.retrying') : t('errors.retry')}
                        </Button>
                      ) : null}
                      <Button onClick={toggleDataSource} variant="outline" size="sm" type="button">
                        {t('errors.showDemo')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : selectedNode && fullGraph ? (
              <>
                <ExhibitView
                  node={selectedNode}
                  connections={connections}
                  dataSource={dataSource}
                  onPrev={prev ? () => select(prev) : undefined}
                  onNext={next ? () => select(next) : undefined}
                  onExpand={dataSource === 'live' ? () => void expandNode(selectedNode) : undefined}
                  expanding={expanding}
                />
                {!wide ? (
                  <aside aria-label={tx('where')} className="grid gap-3.5 pt-8 sm:grid-cols-2 lg:grid-cols-3 [&>section:last-child]:sm:col-span-2 lg:[&>section:last-child]:col-span-1">
                    {context}
                  </aside>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {wide ? (
          <aside aria-label={tx('where')} className="grid min-h-0 content-start gap-3.5 overflow-auto border-l border-border p-[18px]">
            {context}
          </aside>
        ) : null}
      </div>

      {!railColumn ? (
        <Sheet open={railOpen} onOpenChange={setRailOpen}>
          <SheetContent side="left" className="w-[min(22rem,92vw)] gap-0 p-0">
            <SheetTitle className="sr-only">{tx('browseCollection')}</SheetTitle>
            {rail}
          </SheetContent>
        </Sheet>
      ) : null}

      {selectedNode && fullGraph ? (
        <MuseumLens
          kind={lens}
          onClose={() => setLens(null)}
          node={selectedNode}
          graph={fullGraph}
          visibleNodes={visibleNodes}
          onSelect={select}
        />
      ) : null}
    </div>
  );
}
