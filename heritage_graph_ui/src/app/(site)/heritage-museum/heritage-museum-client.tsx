'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconRoute } from '@tabler/icons-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAtlasWords } from '@/app/(site)/atlas/components/atlas-words';
import type { MapCommand } from '@/app/(site)/atlas/components/AtlasMap';
import { useMediaQuery } from '@/hooks/use-media-query';
import { nearbyPlaces, placesOf, type AtlasPlace, type EraId } from '@/lib/heritage-atlas/atlas-model';
import { useAtlasRelief } from '@/lib/heritage-atlas/use-atlas-relief';
import { attachRelations, kgNeighborhoodToGraph } from '@/lib/heritage-museum/live-graph';
import { enrichMuseumGraph } from '@/lib/heritage-museum/museum-graph';
import {
  LENSES,
  eraCounts,
  filterCollection,
  parseMuseumParams,
  serializeMuseumParams,
  yearOfNode,
  type Lens,
} from '@/lib/heritage-museum/museum-state';
import { API_BASE, useHeritageCollection } from '@/lib/heritage-museum/use-heritage-collection';
import { fetchKgNeighborhood } from '@/lib/kg-graph';
import { downloadJson } from '@/lib/provenance';

import type { GraphData, GraphLink, GraphNode, HgCategory } from './heritage-data';
import { CollectionNotices, useCollectionErrorMessage } from './components/CollectionNotices';
import { MandalaLoader } from './components/MandalaLoader';
import { TimelineStrip } from './components/TimelineStrip';
import { CollectionRail } from './components/exhibit/CollectionRail';
import { EgoGraph } from './components/exhibit/EgoGraph';
import { ExhibitView } from './components/exhibit/ExhibitView';
import { connectionsOf, coordsOf } from './components/exhibit/exhibit-utils';
import { RailControls } from './components/exhibit/RailControls';
import { MapLens } from './components/lenses/MapLens';
import { KeyboardHelp } from './components/museum/KeyboardHelp';
import { LENS_PANEL_ID, LensTabs } from './components/museum/LensTabs';
import { PeriodFilter } from './components/museum/PeriodFilter';
import { RecordPanel, type TourState } from './components/museum/RecordPanel';
import { exportVisibleGraphPayload } from './utils/exportGraph';

/** The record panel sits beside the stage from this width; below it, under it. */
const WIDE_QUERY = '(min-width: 1280px)';
/** The collection rail is a column from this width; below it, a sheet. */
const RAIL_QUERY = '(min-width: 1024px)';
const EMPTY: GraphData = { nodes: [], links: [] };
const NEARBY_KM = 15;

/**
 * The Heritage Museum: one collection, four ways to look at it.
 *
 * The museum and the atlas used to be two pages over the same records, each
 * with its own selection and URL, so moving between "what is it" and "where is
 * it" lost the reader's place. Now the record stays open across every lens —
 * exhibit, map, timeline, connections — the collection rail and its filters
 * stay put, and the record panel says where, when, what is near and what the
 * record rests on, whichever lens is showing.
 */
export function HeritageMindMapClient() {
  const { data: session } = useSession();
  const t = useTranslations('heritageMuseum');
  const tx = useTranslations('heritageMuseum.exhibit');
  const tl = useTranslations('heritageMuseum.lenses');
  const { t: ta } = useAtlasWords();
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrappedRef = useRef(false);
  const wide = useMediaQuery(WIDE_QUERY);
  const railColumn = useMediaQuery(RAIL_QUERY);
  const messageFor = useCollectionErrorMessage();

  const collection = useHeritageCollection();
  const { source: dataSource, graph: fullGraph, loading, error, liveLoading, liveError, setLiveGraph, retryLive, datasetMeta } = collection;
  const liveGraph = dataSource === 'live' ? fullGraph : null;
  const { relief, altitudeAt } = useAtlasRelief();

  // ── View state (mirrored to the URL) ──────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>('exhibit');
  const [kind, setKind] = useState<HgCategory | null>(null);
  const [era, setEra] = useState<EraId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // ── Transient UI state ───────────────────────────────────────────────────
  const [railOpen, setRailOpen] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [tour, setTour] = useState<{ stops: string[]; k: number } | null>(null);
  const [mapCommand, setMapCommand] = useState<(MapCommand & { n: number }) | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const switchSource = useCallback(() => {
    if (collection.switchTo(dataSource === 'demo' ? 'live' : 'demo')) {
      setSelectedId(null);
      setTour(null);
    }
  }, [collection, dataSource]);

  // ── Bootstrap from the URL ─────────────────────────────────────────────────
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const initial = parseMuseumParams(new URLSearchParams(searchParams.toString()));
    setLens(initial.lens);
    if (initial.node) setSelectedId(initial.node);
    setKind(initial.kind);
    setEra(initial.era);
    setSearchQuery(initial.q);
    // The reviewed live graph is the default: its records are sourced, while
    // the illustrated corpus's prose is explicitly uncitable. The corpus opens
    // when asked for, or when the live graph is unavailable.
    if (initial.source === 'demo') collection.switchTo('demo');
    else collection.preferLive();
    // Runs once; the collection is stable enough for a one-shot read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── The collection, as listed ──────────────────────────────────────────────
  const visibleNodes = useMemo<GraphNode[]>(
    () => (fullGraph ? filterCollection(fullGraph.nodes, { kind, era, q: searchQuery }) : []),
    [fullGraph, kind, era, searchQuery],
  );
  const periodCounts = useMemo(() => eraCounts(fullGraph?.nodes ?? [], { kind, q: searchQuery }), [fullGraph, kind, searchQuery]);

  // Links per record, for choosing where the page opens.
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    const idOf = (x: string | GraphNode) => (typeof x === 'string' ? x : x.id);
    for (const l of fullGraph?.links ?? []) {
      d.set(idOf(l.source), (d.get(idOf(l.source)) ?? 0) + 1);
      d.set(idOf(l.target), (d.get(idOf(l.target)) ?? 0) + 1);
    }
    return d;
  }, [fullGraph]);

  // The open record: the one asked for, else the best-connected record with a
  // photograph, so a first visit lands where every lens has something to show
  // rather than on whichever record sorts first.
  const selectedNode = useMemo<GraphNode | null>(() => {
    if (!fullGraph?.nodes.length) return null;
    const asked = selectedId ? fullGraph.nodes.find((n) => n.id === selectedId) : undefined;
    if (asked) return asked;
    const pool = visibleNodes.length ? visibleNodes : fullGraph.nodes;
    const photographed = pool.filter((n) => n.imageUrl || n.images?.length);
    const ranked = (photographed.length ? photographed : pool).slice().sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
    return ranked[0] ?? null;
  }, [fullGraph, selectedId, visibleNodes, degree]);

  const connections = useMemo(
    () => (selectedNode && fullGraph ? connectionsOf(selectedNode, fullGraph) : []),
    [selectedNode, fullGraph],
  );

  // ── Places (for the map lens and the record panel) ────────────────────────
  const allPlaces = useMemo(() => (fullGraph ? placesOf(fullGraph.nodes) : []), [fullGraph]);
  const placeById = useMemo(() => new Map(allPlaces.map((p) => [p.node.id, p])), [allPlaces]);
  const visiblePlaces = useMemo(() => placesOf(visibleNodes), [visibleNodes]);
  const selectedPlace = selectedNode ? placeById.get(selectedNode.id) ?? null : null;
  const linkedPlaces = useMemo(
    () => connections.map((c) => placeById.get(c.other.id)).filter((p): p is AtlasPlace => Boolean(p)),
    [connections, placeById],
  );
  const nearby = useMemo(
    () => (selectedPlace ? nearbyPlaces(selectedPlace, allPlaces, NEARBY_KM, new Set(connections.map((c) => c.other.id))).slice(0, 6) : []),
    [selectedPlace, allPlaces, connections],
  );
  const datedCount = useMemo(() => visibleNodes.filter((n) => yearOfNode(n) != null).length, [visibleNodes]);

  // ── Moving around ──────────────────────────────────────────────────────────
  const select = useCallback((node: GraphNode) => {
    setSelectedId(node.id);
    setRailOpen(false);
    stageRef.current?.scrollTo({ top: 0 });
  }, []);
  const selectByUser = useCallback(
    (node: GraphNode) => {
      setTour(null);
      select(node);
    },
    [select],
  );

  const index = selectedNode ? visibleNodes.findIndex((n) => n.id === selectedNode.id) : -1;
  const prev = index > 0 ? visibleNodes[index - 1] : null;
  const next = index >= 0 && index < visibleNodes.length - 1 ? visibleNodes[index + 1] : null;

  const moveMap = useCallback((c: MapCommand) => setMapCommand((p) => ({ ...c, n: (p?.n ?? 0) + 1 })), []);
  const showConnectionsOnMap = useCallback(() => {
    if (!selectedPlace) return;
    setLens('map');
    moveMap({ kind: 'fit', points: [selectedPlace, ...linkedPlaces] });
  }, [selectedPlace, linkedPlaces, moveMap]);

  // ── A walk through time: the dated records in the current view, oldest first ──
  const startTour = useCallback(() => {
    const stops = visibleNodes
      .filter((n) => yearOfNode(n) != null)
      .sort((a, b) => yearOfNode(a)! - yearOfNode(b)!)
      .map((n) => n.id);
    if (!stops.length) return;
    setTour({ stops, k: 0 });
    setSelectedId(stops[0]);
    setRailOpen(false);
  }, [visibleNodes]);
  const tourStep = useCallback((d: 1 | -1) => {
    setTour((cur) => {
      if (!cur) return cur;
      const k = Math.max(0, Math.min(cur.stops.length - 1, cur.k + d));
      setSelectedId(cur.stops[k]);
      return { ...cur, k };
    });
  }, []);
  const tourState: TourState | null = tour
    ? { k: tour.k, n: tour.stops.length, onPrev: () => tourStep(-1), onNext: () => tourStep(1), onEnd: () => setTour(null) }
    : null;

  // ── Keyboard: 1–4 lenses, / search, ←/→ previous/next, Esc ends a walk ─────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (railOpen || e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      const digit = Number(e.key);
      if (digit >= 1 && digit <= LENSES.length) {
        setLens(LENSES[digit - 1]);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('museum-search')?.focus();
        return;
      }
      if (e.key === 'Escape' && tour) {
        setTour(null);
        return;
      }
      // Arrow keys belong to the list, the tabs and the map when those have focus.
      if (el.closest('ul, [role="tablist"], .leaflet-container')) return;
      if (e.key === 'ArrowRight') {
        if (tour) tourStep(1);
        else if (next) selectByUser(next);
      }
      if (e.key === 'ArrowLeft') {
        if (tour) tourStep(-1);
        else if (prev) selectByUser(prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [railOpen, next, prev, selectByUser, tour, tourStep]);

  // ── State → URL, for citable links ─────────────────────────────────────────
  useEffect(() => {
    if (!bootstrappedRef.current || !selectedNode) return;
    const query = serializeMuseumParams({ source: dataSource, node: selectedNode.id, lens, kind, era, q: searchQuery });
    const target = `/heritage-museum?${query}`;
    if (target !== `/heritage-museum?${searchParams.toString()}`) router.replace(target, { scroll: false });
  }, [dataSource, selectedNode, lens, kind, era, searchQuery, router, searchParams]);

  // ── Click-to-expand (live graph only) ─────────────────────────────────────
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
        setLiveGraph((prevGraph) => {
          const current = prevGraph ?? EMPTY;
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

  const handleExportJson = useCallback(() => {
    if (!fullGraph) return;
    const ids = new Set(visibleNodes.map((n) => n.id));
    const idOf = (x: string | GraphNode) => (typeof x === 'string' ? x : x.id);
    downloadJson(
      `heritagegraph-museum-${dataSource}-${new Date().toISOString().slice(0, 10)}.json`,
      exportVisibleGraphPayload(
        { nodes: visibleNodes, links: fullGraph.links.filter((l) => ids.has(idOf(l.source)) && ids.has(idOf(l.target))) },
        datasetMeta,
        dataSource,
      ),
    );
  }, [fullGraph, visibleNodes, datasetMeta, dataSource]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setKind(null);
    setEra(null);
  }, []);

  // ── Pieces ─────────────────────────────────────────────────────────────────
  const rail = (
    <CollectionRail
      allNodes={fullGraph?.nodes ?? []}
      visibleNodes={visibleNodes}
      selectedId={selectedNode?.id ?? null}
      onSelect={selectByUser}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      kind={kind}
      onKindChange={setKind}
      onResetFilters={resetFilters}
      showTitle={railColumn}
      controls={
        <RailControls
          dataSource={dataSource}
          demoCount={collection.demoCount}
          liveLoading={liveLoading}
          onSwitchSource={switchSource}
          provenance={dataSource === 'demo' ? collection.demoProvenance : null}
          liveApiBase={dataSource === 'live' ? API_BASE : null}
          datasetMeta={dataSource === 'live' ? datasetMeta : null}
          onExportJson={dataSource === 'live' ? handleExportJson : undefined}
        />
      }
      filters={
        <div className="grid gap-2.5">
          <PeriodFilter era={era} onEra={setEra} counts={periodCounts} />
          {datedCount > 1 ? (
            <button
              type="button"
              onClick={startTour}
              className="inline-flex cursor-pointer items-center justify-center gap-2 border border-story-ink px-3 py-2 text-sm font-semibold hover:bg-story-ink hover:text-story-paper"
            >
              <IconRoute className="size-4" aria-hidden />
              {ta('tour')}
            </button>
          ) : null}
        </div>
      }
    />
  );

  const panel =
    selectedNode && fullGraph ? (
      <RecordPanel
        node={selectedNode}
        allNodes={fullGraph.nodes}
        connections={connections}
        placeById={placeById}
        nearby={nearby}
        altitude={selectedPlace ? altitudeAt(selectedPlace.lat, selectedPlace.lon) : null}
        source={dataSource}
        lens={lens}
        onLens={setLens}
        onSelect={selectByUser}
        onShowConnectionsOnMap={showConnectionsOnMap}
        tour={tourState}
      />
    ) : null;

  const lensCounts: Partial<Record<Lens, number>> = {
    exhibit: visibleNodes.length,
    map: visiblePlaces.length,
    timeline: datedCount,
    connections: connections.length,
  };

  const stage = (() => {
    if (loading) {
      return (
        <div className="grid min-h-[50vh] place-items-center">
          <MandalaLoader />
        </div>
      );
    }
    if (error && !fullGraph) {
      return (
        <div className="grid min-h-[50vh] place-items-center" role="alert">
          <div className="grid max-w-md justify-items-center gap-3 p-8 text-center">
            <p className="text-sm font-medium">{t('errors.loadTitle')}</p>
            <p className="text-xs text-story-ink-soft">{messageFor(error)}</p>
            {dataSource === 'live' ? (
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {liveError === 'timeout' || liveError === 'live' ? (
                  <Button onClick={retryLive} disabled={liveLoading} variant="outline" size="sm" type="button">
                    {liveLoading ? t('errors.retrying') : t('errors.retry')}
                  </Button>
                ) : null}
                <Button onClick={switchSource} variant="outline" size="sm" type="button">
                  {t('errors.showDemo')}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    if (!selectedNode || !fullGraph) return null;
    if (lens === 'map') {
      return (
        <MapLens
          places={visiblePlaces}
          unlocated={visibleNodes.length - visiblePlaces.length}
          selectedId={selectedNode.id}
          onSelect={(p) => selectByUser(p.node)}
          linked={linkedPlaces}
          relief={relief}
          followSelection={selectedId != null}
          command={mapCommand}
        />
      );
    }
    if (lens === 'timeline') {
      return (
        <div className="flex h-full min-h-[420px] flex-col">
          <TimelineStrip nodes={visibleNodes} selectedId={selectedNode.id} onSelect={selectByUser} />
        </div>
      );
    }
    if (lens === 'connections') {
      return (
        <div className="grid gap-2 px-4 py-5 sm:px-6">
          <p className="text-xs text-story-ink-soft">{tx('graphLensHint')}</p>
          <EgoGraph node={selectedNode} graph={fullGraph} onSelect={selectByUser} />
        </div>
      );
    }
    return (
      <div className="px-4 pt-5 pb-12 sm:px-6 lg:px-[clamp(1.25rem,3vw,2.75rem)] lg:pt-7">
        <ExhibitView
          node={selectedNode}
          connections={connections}
          dataSource={dataSource}
          onPrev={prev ? () => selectByUser(prev) : undefined}
          onNext={next ? () => selectByUser(next) : undefined}
          onExpand={dataSource === 'live' ? () => void expandNode(selectedNode) : undefined}
          expanding={expanding}
          onShowOnMap={coordsOf(selectedNode) ? () => setLens('map') : undefined}
        />
      </div>
    );
  })();

  const fullBleed = lens === 'map' || lens === 'timeline';

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-story-paper text-story-ink">
      <CollectionNotices
        source={dataSource}
        liveError={liveError}
        liveLoading={liveLoading}
        liveCount={liveGraph ? liveGraph.nodes.length : null}
        onRetry={retryLive}
        onShowDemo={switchSource}
        onDismiss={collection.dismissLiveError}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        {railColumn ? (
          <aside aria-label={tx('browseCollection')} className="min-h-0 border-r border-story-rule">
            {rail}
          </aside>
        ) : null}

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-story-rule px-3 py-2 sm:px-4">
            {!railColumn ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setRailOpen(true)}>
                {tx('browseCollection')}
              </Button>
            ) : null}
            <LensTabs lens={lens} onLens={setLens} counts={lensCounts} />
            <span className="ml-auto flex items-center gap-3">
              {index >= 0 ? (
                <span className="text-xs text-story-ink-soft tabular-nums" aria-live="polite">
                  {tl('position', { k: index + 1, n: visibleNodes.length })}
                </span>
              ) : null}
              <KeyboardHelp />
            </span>
          </div>

          <div
            ref={stageRef}
            id={LENS_PANEL_ID}
            role="tabpanel"
            aria-labelledby={`museum-lens-${lens}`}
            className={fullBleed && wide ? 'min-h-0 overflow-hidden' : 'min-h-0 overflow-auto'}
          >
            {fullBleed && !wide ? <div className="h-[62vh] min-h-[420px]">{stage}</div> : stage}
            {!wide && panel ? <div className="border-t border-story-rule px-4 pt-5 pb-10 sm:px-6">{panel}</div> : null}
          </div>
        </div>

        {wide && panel ? (
          <aside aria-label={selectedNode?.label} aria-live="polite" className="min-h-0 overflow-auto border-l border-story-rule p-[18px]">
            {panel}
          </aside>
        ) : null}
      </div>

      {!railColumn ? (
        <Sheet open={railOpen} onOpenChange={setRailOpen}>
          <SheetContent side="left" className="w-[min(22rem,92vw)] gap-0 bg-story-paper p-0">
            <SheetTitle className="sr-only">{tx('browseCollection')}</SheetTitle>
            {rail}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
