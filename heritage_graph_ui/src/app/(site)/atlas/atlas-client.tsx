'use client';

/**
 * The Heritage Atlas: where the collection is.
 *
 * Same layout language as the museum — a list, a stage, and the thing you
 * picked — turned place-first. The stage is a map of Nepal that says
 * something: lines to a place's connections with distances, colour by kind or
 * period, each place's altitude and neighbours, and a few facts computed from
 * the records. It shares the museum's collection (useHeritageCollection), so a
 * record opened here opens in the museum and back, in either data source.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconX } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { connectionsOf } from '@/app/(site)/heritage-museum/components/exhibit/exhibit-utils';
import { RailControls } from '@/app/(site)/heritage-museum/components/exhibit/RailControls';
import { NODE_TYPE_CONFIG } from '@/app/(site)/heritage-museum/heritage-data';
import {
  ERAS,
  decodeGrid,
  elevationAt,
  eraOf,
  mapFacts,
  nearbyPlaces,
  placesOf,
  type AtlasPlace,
  type DecodedGrid,
  type ElevationGrid,
  type EraId,
  type MapFact,
} from '@/lib/heritage-atlas/atlas-model';
import { API_BASE, useHeritageCollection } from '@/lib/heritage-museum/use-heritage-collection';

import type { MapCommand, ReliefMeta } from './components/AtlasMap';
import { readEraColors, useAtlasWords } from './components/atlas-words';
import { EraBar, MapControls } from './components/MapChrome';
import { PlacePanel } from './components/PlacePanel';
import { PlaceRail } from './components/PlaceRail';

const AtlasMap = dynamic(() => import('./components/AtlasMap').then((m) => m.AtlasMap), { ssr: false });

const RAIL_QUERY = '(min-width: 1024px)';
const WIDE_QUERY = '(min-width: 1280px)';
const NEARBY_KM = 15;
const REGION_TYPES = new Set(['Place', 'Settlement']);

interface ReliefFile extends ReliefMeta {
  elevation: { nepal: ElevationGrid; valley: ElevationGrid };
}

export default function AtlasClient() {
  const tm = useTranslations('heritageMuseum');
  const { t, km } = useAtlasWords();
  const router = useRouter();
  const searchParams = useSearchParams();
  const collection = useHeritageCollection();
  const railColumn = useMediaQuery(RAIL_QUERY);
  const wide = useMediaQuery(WIDE_QUERY);
  const bootstrapped = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [era, setEra] = useState<EraId | null>(null);
  const [colorBy, setColorBy] = useState<'kind' | 'period'>('kind');
  const [basemap, setBasemap] = useState<'terrain' | 'streets'>('terrain');
  const [tour, setTour] = useState<{ stops: string[]; k: number } | null>(null);
  const [command, setCommand] = useState<(MapCommand & { n: number }) | null>(null);
  const [relief, setRelief] = useState<ReliefMeta | null>(null);
  const [grids, setGrids] = useState<{ nepal: DecodedGrid; valley: DecodedGrid } | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [eraColors, setEraColors] = useState<Record<EraId, string> | null>(null);

  const move = useCallback((c: MapCommand) => setCommand((prev) => ({ ...c, n: (prev?.n ?? 0) + 1 })), []);

  // ── URL in ──
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const sel = searchParams.get('selected') ?? searchParams.get('node');
    if (sel) setSelectedId(decodeURIComponent(sel));
    if (searchParams.get('source') === 'live') collection.switchTo('live');
    // One-shot read of the incoming URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── relief + elevation, after first paint ──
  useEffect(() => {
    setEraColors(readEraColors());
    fetch('/atlas/relief.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`relief ${r.status}`))))
      .then((f: ReliefFile) => {
        setRelief({ nepal: f.nepal, valley: f.valley });
        setGrids({ nepal: decodeGrid(f.elevation.nepal), valley: decodeGrid(f.elevation.valley) });
      })
      .catch((err) => console.error('atlas: relief failed to load', err));
  }, []);

  // ── places ──
  const graph = collection.graph;
  const allPlaces = useMemo(() => (graph ? placesOf(graph.nodes) : []), [graph]);
  const placeById = useMemo(() => new Map(allPlaces.map((p) => [p.node.id, p])), [allPlaces]);
  const unlocated = (graph?.nodes.length ?? 0) - allPlaces.length;
  const matchesQuery = useCallback(
    (p: AtlasPlace) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return p.node.label.toLowerCase().includes(q) || (NODE_TYPE_CONFIG[p.node.nodeType]?.label ?? '').toLowerCase().includes(q);
    },
    [query],
  );
  const searched = useMemo(() => allPlaces.filter(matchesQuery), [allPlaces, matchesQuery]);
  const visible = useMemo(() => (era ? searched.filter((p) => eraOf(p.year) === era) : searched), [searched, era]);
  const eraCounts = useMemo(() => {
    const c = Object.fromEntries(ERAS.map((e) => [e.id, 0])) as Record<EraId, number>;
    searched.forEach((p) => c[eraOf(p.year)]++);
    return c;
  }, [searched]);

  const degree = useCallback((p: AtlasPlace) => (graph ? connectionsOf(p.node, graph).length : 0), [graph]);
  const selected = useMemo<AtlasPlace | null>(() => {
    if (!allPlaces.length) return null;
    const asked = selectedId ? placeById.get(selectedId) : undefined;
    if (asked) return asked;
    // Open on the best-connected site. Regions (a Place or Settlement such as
    // "Kathmandu Valley") are left out: everything is "in" them, so their lines
    // are a starburst rather than a story.
    const sites = allPlaces.filter((p) => !REGION_TYPES.has(p.node.nodeType));
    const pool = sites.length ? sites : allPlaces;
    return [...pool].sort((a, b) => degree(b) - degree(a) || a.node.label.localeCompare(b.node.label))[0];
  }, [allPlaces, placeById, selectedId, degree]);

  const connections = useMemo(() => (selected && graph ? connectionsOf(selected.node, graph) : []), [selected, graph]);
  const linked = useMemo(
    () => connections.map((c) => placeById.get(c.other.id)).filter((p): p is AtlasPlace => Boolean(p) && visible.includes(p!)),
    [connections, placeById, visible],
  );
  const nearby = useMemo(
    () => (selected ? nearbyPlaces(selected, allPlaces, NEARBY_KM, new Set(connections.map((c) => c.other.id))).slice(0, 6) : []),
    [selected, allPlaces, connections],
  );
  const altitude = useCallback((p: AtlasPlace) => elevationAt(grids, p.lat, p.lon), [grids]);
  const facts = useMemo(() => mapFacts(allPlaces, altitude), [allPlaces, altitude]);

  const colorOf = useCallback(
    (p: AtlasPlace) => (colorBy === 'kind' ? NODE_TYPE_CONFIG[p.node.nodeType]?.color ?? '#888' : eraColors?.[eraOf(p.year)] ?? '#888'),
    [colorBy, eraColors],
  );

  const select = useCallback((p: AtlasPlace) => {
    setSelectedId(p.node.id);
    setRailOpen(false);
  }, []);
  const selectByUser = useCallback(
    (p: AtlasPlace) => {
      setTour(null);
      select(p);
    },
    [select],
  );

  const onFact = useCallback(
    (f: MapFact) => {
      if (f.kind === 'valley') move({ kind: 'valley' });
      else if (f.kind === 'gap') router.push('/contribute');
      else selectByUser(f.place);
    },
    [move, router, selectByUser],
  );

  const startTour = useCallback(() => {
    const stops = allPlaces.filter((p) => p.year != null).sort((a, b) => a.year! - b.year!).map((p) => p.node.id);
    if (!stops.length) return;
    setTour({ stops, k: 0 });
    setSelectedId(stops[0]);
  }, [allPlaces]);
  const tourStep = (d: 1 | -1) =>
    setTour((cur) => {
      if (!cur) return cur;
      const k = Math.max(0, Math.min(cur.stops.length - 1, cur.k + d));
      setSelectedId(cur.stops[k]);
      return { ...cur, k };
    });

  const switchSource = useCallback(() => {
    if (collection.switchTo(collection.source === 'demo' ? 'live' : 'demo')) {
      setSelectedId(null);
      setTour(null);
      setEra(null);
    }
  }, [collection]);

  // ── URL out ──
  useEffect(() => {
    if (!bootstrapped.current || !selected) return;
    const p = new URLSearchParams({ source: collection.source, selected: selected.node.id });
    const target = `/atlas?${p.toString()}`;
    if (target !== `/atlas?${searchParams.toString()}`) router.replace(target, { scroll: false });
  }, [collection.source, selected, router, searchParams]);

  const messageFor = (e: string | null) =>
    e === 'unconfigured' || e === 'notfound'
      ? tm('errors.liveUnavailable')
      : e === 'timeout'
        ? tm('errors.liveTimeout')
        : e === 'live'
          ? tm('errors.liveLoad')
          : e === 'demo'
            ? tm('errors.demoLoad')
            : null;
  const liveRetryable = collection.liveError === 'timeout' || collection.liveError === 'live';

  const rail = (
    <PlaceRail
      places={visible}
      unlocated={unlocated}
      selectedId={selected?.node.id ?? null}
      onSelect={selectByUser}
      query={query}
      onQueryChange={setQuery}
      onResetFilters={() => {
        setQuery('');
        setEra(null);
      }}
      onStartTour={startTour}
      canTour={allPlaces.some((p) => p.year != null)}
      facts={facts}
      onFact={onFact}
      showTitle={railColumn}
      controls={
        <RailControls
          dataSource={collection.source}
          demoCount={collection.demoCount}
          liveLoading={collection.liveLoading}
          onSwitchSource={switchSource}
          provenance={collection.source === 'demo' ? collection.demoProvenance : null}
          liveApiBase={collection.source === 'live' ? API_BASE : null}
          datasetMeta={collection.datasetMeta}
        />
      }
    />
  );

  const panel = selected ? (
    <PlacePanel
      place={selected}
      connections={connections}
      placeById={placeById}
      nearby={nearby}
      altitude={altitude(selected)}
      source={collection.source}
      onSelectPlace={selectByUser}
      onShowConnections={() => move({ kind: 'fit', points: [selected, ...connections.map((c) => placeById.get(c.other.id)).filter((p): p is AtlasPlace => Boolean(p))] })}
      tour={
        tour
          ? { k: tour.k, n: tour.stops.length, onPrev: () => tourStep(-1), onNext: () => tourStep(1), onEnd: () => setTour(null) }
          : null
      }
    />
  ) : collection.loading ? (
    <p className="text-sm text-muted-foreground" role="status">
      {tm('dataSource.loading')}
    </p>
  ) : (
    <p className="text-sm text-muted-foreground">{t('empty')}</p>
  );

  const stage = (
    <section aria-label={t('mapAria', { count: visible.length })} className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] bg-muted">
      <div className="relative min-h-[360px]">
        <AtlasMap
          places={visible}
          selectedId={selected?.node.id ?? null}
          onSelect={selectByUser}
          colorOf={colorOf}
          linked={linked}
          relief={relief}
          basemap={basemap}
          command={command}
          followSelection={selectedId != null}
          formatKm={km}
          labels={{ mapAria: t('mapAria', { count: visible.length }), cluster: (n) => t('clusterAria', { count: n }), attribution: t('attribution') }}
        />
        <MapControls onExtent={(k) => move({ kind: k })} basemap={basemap} onBasemap={setBasemap} colorBy={colorBy} onColorBy={setColorBy} places={visible} />
      </div>
      <EraBar counts={eraCounts} era={era} onEra={setEra} shown={visible.length} />
    </section>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {collection.liveError ? (
        <div className="z-20 flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{messageFor(collection.liveError)}</span>
          <span className="ml-auto flex items-center gap-2">
            {liveRetryable ? (
              <Button onClick={collection.retryLive} disabled={collection.liveLoading} variant="outline" size="sm" className="h-7 text-xs" type="button">
                {collection.liveLoading ? tm('errors.retrying') : tm('errors.retry')}
              </Button>
            ) : null}
            {collection.source === 'live' ? (
              <Button onClick={switchSource} variant="outline" size="sm" className="h-7 text-xs" type="button">
                {tm('errors.showDemo')}
              </Button>
            ) : null}
            <Button onClick={collection.dismissLiveError} variant="ghost" size="icon" className="size-7" aria-label={tm('errors.dismiss')} type="button">
              <IconX className="size-4" />
            </Button>
          </span>
        </div>
      ) : null}
      {collection.source === 'live' && graph && graph.nodes.length < 20 ? (
        <div className="flex-shrink-0 border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground" role="status">
          {tm('sparseLive', { count: graph.nodes.length })}{' '}
          <Link href="/contribute/entity" className="text-primary underline underline-offset-2">
            {tm('sparseLiveContribute')}
          </Link>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        {railColumn ? (
          <aside aria-label={t('browsePlaces')} className="min-h-0 border-r border-border">
            {rail}
          </aside>
        ) : null}

        {wide ? (
          stage
        ) : (
          <div className="min-h-0 overflow-auto">
            {!railColumn ? (
              <div className="sticky top-0 z-[600] flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5">
                <h1 className="font-serif text-xl leading-tight">{t('title')}</h1>
                <Button type="button" variant="outline" size="sm" onClick={() => setRailOpen(true)}>
                  {t('browsePlaces')}
                </Button>
              </div>
            ) : null}
            <div className="grid h-[62vh] min-h-[420px]">{stage}</div>
            <div className="px-4 pt-4 pb-10 sm:px-6">{panel}</div>
          </div>
        )}

        {wide ? (
          <aside aria-label={selected?.node.label ?? t('title')} aria-live="polite" className="min-h-0 overflow-auto border-l border-border p-[18px]">
            {panel}
          </aside>
        ) : null}
      </div>

      {!railColumn ? (
        <Sheet open={railOpen} onOpenChange={setRailOpen}>
          <SheetContent side="left" className="w-[min(22rem,92vw)] gap-0 p-0">
            <SheetTitle className="sr-only">{t('browsePlaces')}</SheetTitle>
            {rail}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}
