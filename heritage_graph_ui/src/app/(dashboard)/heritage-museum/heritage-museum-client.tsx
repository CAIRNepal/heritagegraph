'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { IconX } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPublicApiUrl, isPublicApiUrlConfigured } from '@/lib/api-base';
import {
  fetchHeritageDemoCorpus,
  NODE_TYPE_CONFIG,
  HG_CATEGORY_CONFIG,
  type NodeType,
  type HgCategory,
  type GraphNode,
  type GraphData,
  type GraphLink,
} from './heritage-data';
import {
  fetchInstanceGraphData,
  type InstanceNode,
  type InstanceEdge,
  type InstanceCategory,
} from '@/lib/instance-graph';
import { FilterBar } from './components/FilterBar';
import { StoryPanel } from './components/StoryPanel';
import { MandalaLoader } from './components/MandalaLoader';
import { TimelineStrip } from './components/TimelineStrip';
import { GraphLegend } from './components/GraphLegend';
import { MuseumToolbar, type MuseumDataSource, type MuseumViewMode } from './components/museum-toolbar';
import { cn } from '@/lib/utils';

const API_BASE = getPublicApiUrl();

// ── View / data mode types ─────────────────────────────────────────────────────
type ViewMode = MuseumViewMode;
type DataSource = MuseumDataSource;

// ── Instance → museum node conversion ─────────────────────────────────────────
//
// Each backend InstanceCategory is mapped to the closest matching NodeType in
// the generated ontology viz config. This is the SINGLE place where backend
// taxonomy is translated to the visualization taxonomy.
const INSTANCE_CAT_MAP: Record<InstanceCategory, NodeType> = {
  structure:   'ArchitecturalStructure',
  deity:       'Deity',
  person:      'Person',
  location:    'Place',
  event:       'HistoricalEvent',
  ritual:      'Festival',          // No RitualEvent NodeType yet; Festival is the nearest analog
  festival:    'Festival',
  guthi:       'Guthi',
  monument:    'BuddhistMonument',
  iconography: 'IconographicObject',
  period:      'HistoricalPeriod',
  tradition:   'ReligiousTradition',
  source:      'Source',
};

// ── rawData → GraphNode field extractors ─────────────────────────────────────
//
// Per-category extractors that pull human-facing strings, coordinates, dates,
// and tags from the DRF response shape. We never trust types here — every
// access is defensive (typeof / Array.isArray).

type Raw = Record<string, unknown>;

function s(raw: Raw, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return undefined;
}

function pickLatLong(raw: Raw): { lat?: string; long?: string } {
  // Direct lat/lng fields (Monument, Structure, Location serializers expose these)
  const lat = s(raw, 'latitude', 'lat');
  const long = s(raw, 'longitude', 'long', 'lng');
  if (lat && long) return { lat, long };

  // GeoJSON-ish "point" field: { type: 'Point', coordinates: [lng, lat] }
  const point = raw.point as { coordinates?: [number, number] } | undefined;
  if (point && Array.isArray(point.coordinates) && point.coordinates.length === 2) {
    const [lngN, latN] = point.coordinates;
    if (Number.isFinite(latN) && Number.isFinite(lngN)) {
      return { lat: String(latN), long: String(lngN) };
    }
  }
  return {};
}

function pickInceptionYear(raw: Raw): string | undefined {
  // EDTF strings ("c.1200", "1768"): pull the first 4-digit run
  const candidates = [
    raw.inception_year, raw.construction_date, raw.start_year,
    raw.founded_in, raw.start_date, raw.birth_date,
  ];
  for (const c of candidates) {
    if (typeof c !== 'string') continue;
    const m = c.match(/-?\d{3,4}/);
    if (m) return m[0];
  }
  return undefined;
}

function pickImage(raw: Raw): string | undefined {
  const direct = s(raw, 'image_url', 'imageUrl', 'image', 'thumbnail', 'photo_url');
  if (direct && /^https?:\/\//.test(direct)) return direct;
  return undefined;
}

function pickTags(raw: Raw): string[] | undefined {
  const t = raw.tags;
  if (Array.isArray(t)) return t.map(String).filter(Boolean);
  if (typeof t === 'string' && t.trim()) {
    return t.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return undefined;
}

function instanceToGraphNode(n: InstanceNode): GraphNode {
  const nodeType = INSTANCE_CAT_MAP[n.category] ?? 'Place';
  const cfg = NODE_TYPE_CONFIG[nodeType];
  const raw = n.rawData ?? {};
  const { lat, long } = pickLatLong(raw);

  return {
    id: n.id,
    label: n.label,
    nodeType,
    cidocMapping: cfg.cidocMapping,
    hgCategory: cfg.hgCategory as GraphNode['hgCategory'],
    description: n.description || s(raw, 'note', 'description', 'biography') || '',
    storyText: s(raw, 'story', 'narrative', 'story_text') || n.description || '',
    imageUrl: pickImage(raw),
    significance: s(raw, 'significance', 'cultural_significance'),
    religion: s(raw, 'religion', 'religious_tradition', 'tradition'),
    unescoStatus: s(raw, 'unesco_status', 'unescoStatus'),
    inceptionYear: pickInceptionYear(raw),
    dynasty: s(raw, 'dynasty', 'ruling_dynasty'),
    ethnicity: s(raw, 'ethnicity', 'caste_group'),
    period: s(raw, 'period', 'historical_period'),
    lat,
    long,
    history: s(raw, 'history', 'historical_context'),
    architecture: s(raw, 'architecture', 'architectural_style'),
    culturalRole: s(raw, 'cultural_role'),
    visitNote: s(raw, 'visit_note', 'visitor_information'),
    tags: pickTags(raw),
    relations: [],
  };
}

// Live edge labels emitted by instance-graph.ts must use predicate keys that
// match RELATION_LABELS (underscore-style). We pass them through as-is here;
// the heritage-data RELATION_LABELS map covers the full set.
function instanceEdgeToLink(e: InstanceEdge): GraphLink {
  const predicate = (e.label || 'associated_with').replace(/-/g, '_');
  return { source: e.source, target: e.target, predicate };
}

// Build a HeritageRelation[] for every node from the edge list so the
// StoryPanel's Connections section works for live data too.
function attachRelations(nodes: GraphNode[], links: GraphLink[]): void {
  const byId = new Map<string, GraphNode>();
  for (const n of nodes) {
    n.relations = [];
    byId.set(n.id, n);
  }
  for (const l of links) {
    const sourceId = typeof l.source === 'string' ? l.source : l.source.id;
    const targetId = typeof l.target === 'string' ? l.target : l.target.id;
    const src = byId.get(sourceId);
    const tgt = byId.get(targetId);
    if (src && tgt) {
      src.relations.push({ predicate: l.predicate, targetId, targetLabel: tgt.label });
    }
  }
}

// ── Dynamic imports ────────────────────────────────────────────────────────────
const ALL_TYPES = new Set(Object.keys(NODE_TYPE_CONFIG) as NodeType[]);
const ALL_CATS  = new Set(Object.keys(HG_CATEGORY_CONFIG) as HgCategory[]);
const EMPTY: GraphData = { nodes: [], links: [] };

const ForceGraph = dynamic(
  () => import('./components/ForceGraph').then((m) => m.ForceGraph),
  { ssr: false, loading: () => <div className="absolute inset-0 flex items-center justify-center"><MandalaLoader /></div> },
);
const ImmersiveScene = dynamic(
  () => import('./components/xr/ImmersiveScene').then((m) => m.ImmersiveScene),
  { ssr: false },
);
const PlaceNav = dynamic(
  () => import('./components/xr/PlaceNav').then((m) => m.PlaceNav),
  { ssr: false },
);
const MapView = dynamic(
  () => import('./components/MapView').then((m) => m.MapView),
  { ssr: false, loading: () => <div className="absolute inset-0 flex items-center justify-center"><MandalaLoader /></div> },
);

// ══════════════════════════════════════════════════════════════════════════════
export function HeritageMindMapClient() {
  const { data: session } = useSession();
  const t = useTranslations('heritageMuseum');

  // ── Demo data ──────────────────────────────────────────────────────────────
  const [demoGraph,   setDemoGraph]   = useState<GraphData | null>(null);
  const [demoProv,    setDemoProv]    = useState<{
    retrieved?: string;
    generatedBy?: string;
    imageSource?: string;
    note?: string;
  } | null>(null);
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoError,   setDemoError]   = useState<string | null>(null);

  // ── Live data ──────────────────────────────────────────────────────────────
  const [liveGraph,   setLiveGraph]   = useState<GraphData | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError,   setLiveError]   = useState<string | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [dataSource,   setDataSource]   = useState<DataSource>('demo');
  const [viewMode,     setViewMode]     = useState<ViewMode>('2d');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeTypes,  setActiveTypes]  = useState<Set<NodeType>>(ALL_TYPES);
  const [activeCats,   setActiveCats]   = useState<Set<HgCategory>>(ALL_CATS);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [panelOpen,    setPanelOpen]    = useState(false);

  // ── Load demo data once ────────────────────────────────────────────────────
  useEffect(() => {
    fetchHeritageDemoCorpus()
      .then(({ graph, provenance }) => {
        setDemoGraph(graph);
        setDemoProv(provenance ? {
          retrieved: provenance.retrieved,
          generatedBy: provenance.generatedBy,
          imageSource: provenance.imageSource,
          note: provenance.note,
        } : null);
        setDemoLoading(false);
      })
      .catch(() => { setDemoError('demo'); setDemoLoading(false); });
  }, []);

  // ── Load live data on demand ───────────────────────────────────────────────
  const loadLiveData = useCallback(async () => {
    if (!API_BASE || !isPublicApiUrlConfigured()) {
      setLiveError('unconfigured');
      setLiveLoading(false);
      return;
    }
    setLiveLoading(true);
    setLiveError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const token = (session as any)?.accessToken as string | undefined;
      const raw = await fetchInstanceGraphData(API_BASE, token);
      const nodes = raw.nodes.map(instanceToGraphNode);
      const links = raw.edges.map(instanceEdgeToLink);
      // Populate node.relations so the StoryPanel "Connections" section
      // and the neighbor-highlight logic both work for live data.
      attachRelations(nodes, links);
      setLiveGraph({ nodes, links });
    } catch {
      setLiveError('live');
      // Stay in 'live' mode so a Retry click is intuitive — the user sees the
      // error banner and the toggle button switches back to demo if they want.
    } finally {
      setLiveLoading(false);
    }
  }, [session]);

  const toggleDataSource = useCallback(() => {
    if (dataSource === 'demo') {
      if (!API_BASE || !isPublicApiUrlConfigured()) {
        setLiveError('unconfigured');
        return;
      }
      setDataSource('live');
      if (!liveGraph) loadLiveData();
    } else {
      setDataSource('demo');
    }
    setSelectedNode(null);
  }, [dataSource, liveGraph, loadLiveData]);

  const retryLiveData = useCallback(() => {
    setLiveError(null);
    loadLiveData();
  }, [loadLiveData]);

  const showAllCategories = useCallback(() => setActiveCats(new Set(ALL_CATS)), []);
  const showAllTypes      = useCallback(() => setActiveTypes(new Set(ALL_TYPES)), []);
  const resetFilters      = useCallback(() => {
    setActiveCats(new Set(ALL_CATS));
    setActiveTypes(new Set(ALL_TYPES));
    setSearchQuery('');
  }, []);

  // ── Active graph (demo vs live) ────────────────────────────────────────────
  const fullGraph = dataSource === 'live' ? liveGraph : demoGraph;
  const loading   = dataSource === 'live' ? liveLoading : demoLoading;
  const error     = dataSource === 'live' ? liveError   : demoError;

  // ── Filtered graph (type + category + search) ──────────────────────────────
  const filteredGraph = useMemo<GraphData | null>(() => {
    if (!fullGraph) return null;
    const q = searchQuery.toLowerCase();
    const visible = fullGraph.nodes.filter((n) => {
      if (!activeTypes.has(n.nodeType)) return false;
      if (!activeCats.has(n.hgCategory as HgCategory)) return false;
      if (!q) return true;
      return (
        n.label.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.tags?.some((t) => t.toLowerCase().includes(q))
      );
    });
    const ids = new Set(visible.map((n) => n.id));
    return {
      nodes: visible,
      links: fullGraph.links.filter(
        (l) => ids.has(l.source as string) && ids.has(l.target as string),
      ),
    };
  }, [fullGraph, activeTypes, activeCats, searchQuery]);

  // ── Neighbour highlight ────────────────────────────────────────────────────
  // Important: read links from `fullGraph`, not `filteredGraph`. D3's
  // forceLink() mutates `link.source` / `link.target` from string IDs to the
  // GraphNode objects after the simulation runs — so comparing those to a
  // string ID always returns false. `fullGraph` is the immutable source.
  const highlightedIds = useMemo<Set<string>>(() => {
    if (!selectedNode || !fullGraph) return new Set();
    const ids = new Set<string>([selectedNode.id]);
    for (const l of fullGraph.links) {
      const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
      const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
      if (src === selectedNode.id) ids.add(tgt);
      if (tgt === selectedNode.id) ids.add(src);
    }
    return ids;
  }, [selectedNode, fullGraph]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNodeSelect = useCallback((node: GraphNode) => {
    let deselecting = false;
    setSelectedNode((prev) => {
      deselecting = prev?.id === node.id;
      return deselecting ? null : node;
    });
    setPanelOpen(!deselecting);
  }, []);

  const handleRelatedNodeClick = useCallback(
    (id: string) => {
      const n = fullGraph?.nodes.find((n) => n.id === id);
      if (n) handleNodeSelect(n);
    },
    [fullGraph, handleNodeSelect],
  );

  const toggleType = useCallback((type: NodeType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) { if (next.size > 1) next.delete(type); }
      else next.add(type);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((cat: HgCategory) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) { if (next.size > 1) next.delete(cat); }
      else next.add(cat);
      return next;
    });
  }, []);

  const switchToXR = useCallback((node?: GraphNode) => {
    if (node) setSelectedNode(node);
    setViewMode('xr');
  }, []);

  const nodeCount = filteredGraph?.nodes.length ?? 0;
  const linkCount = filteredGraph?.links.length ?? 0;

  // Per-type counts for the legend
  const typeCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    if (!filteredGraph) return counts;
    for (const n of filteredGraph.nodes) {
      counts[n.nodeType] = (counts[n.nodeType] || 0) + 1;
    }
    return counts;
  }, [filteredGraph]);

  const errorMessage =
    error === 'unconfigured'
      ? 'Live data source is not configured (set NEXT_PUBLIC_API_URL).'
      : error === 'live'
        ? t('errors.liveLoad')
        : error === 'demo'
          ? t('errors.demoLoad')
          : null;

  const provenanceText =
    dataSource === 'demo' && demoProv?.retrieved
      ? `Demo corpus frozen ${demoProv.retrieved}${demoProv.imageSource ? ` · Images: ${demoProv.imageSource}` : ''}`
      : dataSource === 'live'
        ? (API_BASE ? `Live API: ${API_BASE}` : null)
        : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">

      <MuseumToolbar
        viewMode={viewMode}
        onViewModeChange={(mode) => (mode === 'xr' ? switchToXR() : setViewMode(mode))}
        dataSource={dataSource}
        liveLoading={liveLoading}
        onToggleDataSource={toggleDataSource}
        nodeCount={nodeCount}
        linkCount={linkCount}
        showStats={!loading}
        provenanceText={provenanceText}
        provenance={dataSource === 'demo' ? demoProv : null}
        liveApiBase={dataSource === 'live' ? API_BASE : null}
      />

      {liveError && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs z-20"
          role="alert"
          aria-live="polite"
        >
          <span aria-hidden="true">⚠</span>
          <span>{t('errors.liveLoad')}</span>
          <Button
            onClick={retryLiveData}
            disabled={liveLoading}
            variant="outline"
            size="sm"
            className="ml-auto h-7 text-xs"
            type="button"
          >
            {liveLoading ? t('errors.retrying') : t('errors.retry')}
          </Button>
          <Button
            onClick={() => setLiveError(null)}
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={t('errors.dismiss')}
            type="button"
          >
            <IconX className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── 2D / Map modes ── */}
      {(viewMode === '2d' || viewMode === 'map') && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Filter bar — visible in both 2D and Map modes */}
          <div className="z-10 flex-shrink-0">
            <FilterBar
              activeTypes={activeTypes}
              onToggle={toggleType}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeCategoryFilter={activeCats}
              onCategoryToggle={toggleCategory}
              onShowAllCategories={showAllCategories}
              onShowAllTypes={showAllTypes}
              totalNodes={fullGraph?.nodes.length}
              visibleNodes={filteredGraph?.nodes.length}
            />
          </div>

          {/* Grid: graph | story (scroll) on row 1; timeline spans full width on row 2 */}
          <div
            className={cn(
              'grid min-h-0 flex-1',
              viewMode === '2d'
                ? 'grid-rows-[minmax(0,1fr)_minmax(0,1fr)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_24rem]'
                : 'grid-cols-1 grid-rows-[minmax(0,1fr)]',
            )}
          >
            {/* Graph / Map canvas */}
            <div className="relative min-h-0 min-w-0">
              {viewMode === '2d' && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/[0.04] blur-3xl" />
                  <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-indigo-500/[0.04] blur-3xl" />
                </div>
              )}

              {loading && <div className="absolute inset-0"><MandalaLoader /></div>}
              {!loading && error && (
                <div className="absolute inset-0 flex items-center justify-center" role="alert">
                  <div className="text-center space-y-3 p-8 max-w-md">
                    <p className="text-4xl" aria-hidden="true">⚠️</p>
                    <p className="text-foreground text-sm font-medium">{t('errors.loadTitle')}</p>
                    <p className="text-muted-foreground text-xs">{errorMessage}</p>
                    {dataSource === 'live' && (
                      <Button
                        onClick={retryLiveData}
                        disabled={liveLoading}
                        variant="outline"
                        size="sm"
                        className="mt-2 text-xs"
                        type="button"
                      >
                        {liveLoading ? t('errors.retrying') : t('errors.retry')}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Empty-state for filter-driven zero results */}
              {!loading && !error && fullGraph && nodeCount === 0 && fullGraph.nodes.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center" role="status">
                  <div className="text-center space-y-3 p-8 max-w-md">
                    <p className="text-4xl" aria-hidden="true">🔭</p>
                    <p className="text-foreground text-sm font-medium">{t('empty.filtersTitle')}</p>
                    <p className="text-muted-foreground text-xs">{t('empty.filtersBody', { total: fullGraph.nodes.length })}</p>
                    <Button onClick={resetFilters} type="button" variant="outline" size="sm" className="mt-2 text-xs">
                      {t('empty.resetFilters')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Force graph */}
              {viewMode === '2d' && !loading && !error && nodeCount > 0 && (
                <div className="absolute inset-0">
                  <ForceGraph
                    data={filteredGraph ?? EMPTY}
                    selectedId={selectedNode?.id ?? null}
                    onNodeSelect={handleNodeSelect}
                    highlightedIds={highlightedIds}
                  />
                </div>
              )}

              {/* Map */}
              {viewMode === 'map' && !loading && !error && nodeCount > 0 && (
                <div className="absolute inset-0">
                  <MapView
                    nodes={filteredGraph?.nodes ?? []}
                    selectedId={selectedNode?.id ?? null}
                    onNodeSelect={handleNodeSelect}
                  />
                </div>
              )}

              {/* Hint */}
              {viewMode === '2d' && !loading && !error && !selectedNode && nodeCount > 0 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="text-xs text-muted-foreground bg-card/90 backdrop-blur-sm rounded-full px-4 py-2 border border-border flex items-center gap-2 shadow-sm">
                    <span className="animate-bounce inline-block">👆</span>
                    {t('hints.graph')} ·{' '}
                    <button
                      className="pointer-events-auto text-primary hover:underline underline-offset-2"
                      onClick={() => switchToXR()}
                      type="button"
                    >
                      {t('switchToXr')}
                    </button>
                  </div>
                </div>
              )}

              {/* View in XR button */}
              {viewMode === '2d' && !loading && !error && selectedNode && (
                <div className="absolute top-3 right-3">
                  <Button onClick={() => switchToXR(selectedNode)} size="sm" variant="secondary" className="text-xs gap-1.5">
                    {t('viewInXr')}
                  </Button>
                </div>
              )}

              {/* Live data badge */}
              {dataSource === 'live' && !loading && (
                <Badge className="absolute top-3 left-3 gap-1.5 text-[10px] font-semibold shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
                  {t('liveBadge')}
                </Badge>
              )}

              {/* Legend (2D + Map) */}
              {!loading && !error && nodeCount > 0 && (
                <GraphLegend
                  typeCounts={typeCounts}
                  activeTypes={activeTypes}
                  onTypeClick={toggleType}
                />
              )}
            </div>

            {/* Desktop story sidebar — isolated vertical scroll */}
            <div className="hidden min-h-0 overflow-hidden border-l border-border bg-card/80 backdrop-blur-md lg:block">
              <StoryPanel
                node={selectedNode}
                graphData={fullGraph ?? EMPTY}
                onRelatedNodeClick={handleRelatedNodeClick}
              />
            </div>

            {/* Timeline: lower half of workspace (2D only) */}
            {viewMode === '2d' && !loading && !error && (
              <div className="flex min-h-0 flex-col border-t border-border lg:col-span-2">
                <TimelineStrip
                  nodes={filteredGraph?.nodes ?? []}
                  selectedId={selectedNode?.id ?? null}
                  onSelect={handleNodeSelect}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── XR Mode ── */}
      {viewMode === 'xr' && (
        <div className="flex flex-1 min-h-0 relative">
          <div className="w-52 flex-shrink-0">
            <PlaceNav
              nodes={filteredGraph?.nodes ?? []}
              selectedId={selectedNode?.id ?? null}
              onSelect={handleNodeSelect}
            />
          </div>
          <div className="flex-1 min-w-0 relative">
            {loading ? <MandalaLoader /> : (
              <ImmersiveScene
                node={selectedNode}
                allNodes={filteredGraph?.nodes ?? []}
                onSelect={handleNodeSelect}
              />
            )}
            {/* Back-to-graph contextual button inside the 3D scene */}
            <Button
              onClick={() => setViewMode('2d')}
              type="button"
              variant="secondary"
              size="sm"
              className="absolute top-3 left-3 z-20 text-xs"
            >
              {t('backToGraph')}
            </Button>
          </div>
        </div>
      )}

      {/* Mobile story drawer (2D only) */}
      {viewMode === '2d' && panelOpen && selectedNode && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div className="flex-1 bg-background/60 backdrop-blur-sm" onClick={() => setPanelOpen(false)} />
          <div className="bg-card border-t border-border h-3/4 rounded-t-2xl overflow-hidden flex flex-col relative">
            <div className="flex items-center justify-center px-5 py-3 border-b border-border flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted" />
              <Button onClick={() => setPanelOpen(false)} className="absolute right-5" variant="ghost" size="icon" aria-label={t('errors.dismiss')}><IconX className="w-4 h-4" /></Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <StoryPanel
                node={selectedNode}
                graphData={fullGraph ?? EMPTY}
                onRelatedNodeClick={(id) => {
                  handleRelatedNodeClick(id);
                  setPanelOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
