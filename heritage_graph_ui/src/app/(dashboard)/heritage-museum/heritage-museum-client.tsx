'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
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
  fetchKgGraph,
  fetchKgNeighborhood,
  rdfTypeToNodeType,
  type KgGraphResponse,
  type KgNeighborhoodResponse,
} from '@/lib/kg-graph';
import { FilterBar } from './components/FilterBar';
import { StoryPanel } from './components/StoryPanel';
import { MandalaLoader } from './components/MandalaLoader';
import { TimelineStrip } from './components/TimelineStrip';
import { GraphLegend } from './components/GraphLegend';
import { MuseumToolbar, type MuseumDataSource, type MuseumViewMode } from './components/museum-toolbar';
import {
  datasetMetaFromKgResponse,
  downloadJson,
  exportVisibleGraphPayload,
  type MuseumDatasetMeta,
} from '@/lib/heritage-museum/museum-rigor';
import {
  collapseClusterDuplicates,
  enrichKgNodeForMuseum,
  enrichMuseumGraph,
} from '@/lib/heritage-museum/museum-graph';
import { buildTimelineLayout } from '@/lib/heritage-museum/timeline-layout';
import { cn } from '@/lib/utils';

const API_BASE = getPublicApiUrl();

// ── View / data mode types ─────────────────────────────────────────────────────
type ViewMode = MuseumViewMode;
type DataSource = MuseumDataSource;

// ── Live Knowledge Graph → museum graph conversion ────────────────────────────
//
// The live view reads the Oxigraph PUBLIC graph: every node is typed by its real
// rdf:type and every edge is a real triple (see lib/kg-graph.ts + the backend
// /kg/graph/ endpoint). Node types come straight from the ontology via
// RDF_CLASS_URI_TO_NODE_TYPE — no lossy category enum, no heuristic edges.
// Nodes whose rdf:type maps to no NodeType are dropped to stay ontology-faithful.
function kgToGraphData(resp: KgGraphResponse): GraphData {
  const nodes: GraphNode[] = [];
  const kept = new Set<string>();

  for (const n of resp.nodes) {
    const nodeType = rdfTypeToNodeType(n.types);
    if (!nodeType) continue; // not an ontology class we visualise
    const cfg = NODE_TYPE_CONFIG[nodeType];
    kept.add(n.id);
    const isLux = n.sourceLayer === 'lux';
    const narrative = enrichKgNodeForMuseum(n, nodeType);
    nodes.push({
      id: n.id,
      label: n.label,
      nodeType,
      cidocMapping: cfg.cidocMapping,
      hgCategory: cfg.hgCategory as GraphNode['hgCategory'],
      description: narrative.description,
      storyText: narrative.storyText,
      imageUrl: narrative.imageUrl,
      images: narrative.images,
      imageCredits: narrative.imageCredits,
      lat: n.lat ?? undefined,
      long: n.long ?? undefined,
      inceptionYear: n.inceptionYear ?? undefined,
      tags: isLux ? ['Yale LUX', 'Collection link'] : undefined,
      keyFacts: narrative.keyFacts,
      clusterId: n.clusterId ?? undefined,
      clusterLabel: n.clusterLabel ?? undefined,
      typeScope: n.typeScope ?? undefined,
      canonicalMemberId: n.canonicalMemberId ?? undefined,
      relations: [],
    });
  }

  const links: GraphLink[] = resp.edges
    .filter((e) => kept.has(e.source) && kept.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      predicate: (e.predicateLocal || 'associated_with').replace(/-/g, '_'),
      provenance: e.provenance ?? null,
    }));

  return collapseClusterDuplicates({ nodes, links });
}

// Local name of an IRI (after the last # or /).
function iriLocalName(iri: string): string {
  if (!iri) return '';
  const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return i >= 0 ? iri.slice(i + 1) : iri;
}

// Convert a node's neighborhood (click-to-expand) into nodes + links. Only typed
// resource neighbours are kept — literals (label/comment) and untyped IRIs drop out.
function kgNeighborhoodToGraph(
  centerId: string,
  resp: KgNeighborhoodResponse,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const seen = new Set<string>();

  for (const e of resp.edges) {
    if (!e.value || !/^https?:\/\//.test(e.value)) continue; // skip literals
    const nodeType = e.valueType ? rdfTypeToNodeType([e.valueType]) : null;
    if (!nodeType) continue; // only render ontology-typed neighbours
    if (!seen.has(e.value)) {
      seen.add(e.value);
      const cfg = NODE_TYPE_CONFIG[nodeType];
      const isLux = e.value.includes('/imported/lux/');
      const narrative = enrichKgNodeForMuseum(
        {
          id: e.value,
          types: e.valueType ? [e.valueType] : [],
          label: e.valueLabel || iriLocalName(e.value),
          comment: null,
          lat: null,
          long: null,
          sourceLayer: isLux ? 'lux' : 'curated',
          externalUri: isLux ? e.value : null,
        },
        nodeType,
      );
      nodes.push({
        id: e.value,
        label: e.valueLabel || iriLocalName(e.value),
        nodeType,
        cidocMapping: cfg.cidocMapping,
        hgCategory: cfg.hgCategory as GraphNode['hgCategory'],
        description: narrative.description,
        storyText: narrative.storyText,
        keyFacts: narrative.keyFacts,
        tags: isLux ? ['Yale LUX', 'Collection link'] : undefined,
        relations: [],
      });
    }
    const predicate = (iriLocalName(e.predicate) || 'associated_with').replace(/-/g, '_');
    links.push(
      e.direction === 'outbound'
        ? { source: centerId, target: e.value, predicate }
        : { source: e.value, target: centerId, predicate },
    );
  }
  return { nodes, links };
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
      src.relations.push({
        predicate: l.predicate,
        targetId,
        targetLabel: tgt.label,
        provenance: l.provenance ?? null,
      });
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrappedRef = useRef(false);
  const urlSyncedRef = useRef(false);

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
  const [datasetMeta, setDatasetMeta] = useState<MuseumDatasetMeta | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [dataSource,   setDataSource]   = useState<DataSource>('demo');
  const [viewMode,     setViewMode]     = useState<ViewMode>('2d');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeTypes,  setActiveTypes]  = useState<Set<NodeType>>(ALL_TYPES);
  const [activeCats,   setActiveCats]   = useState<Set<HgCategory>>(ALL_CATS);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [expanding,    setExpanding]    = useState(false);

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
      const resp = await fetchKgGraph(API_BASE, token, { includeLux: 'linked' });
      const { nodes, links } = kgToGraphData(resp);
      setDatasetMeta(datasetMetaFromKgResponse(resp, API_BASE));
      // Populate node.relations so the StoryPanel "Connections" section
      // and the neighbor-highlight logic both work for live data.
      attachRelations(nodes, links);
      enrichMuseumGraph({ nodes, links });
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

  // Default to live reviewed KG when API is configured (Nature-rigor honesty).
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const viewParam = searchParams.get('view');
    if (viewParam === '2d' || viewParam === 'map' || viewParam === 'xr') {
      setViewMode(viewParam);
    }
    if (searchParams.get('source') === 'demo') return;
    if (API_BASE && isPublicApiUrlConfigured()) {
      setDataSource('live');
      void loadLiveData();
    }
  }, [searchParams, loadLiveData]);

  const switchToLive = useCallback(() => {
    if (!API_BASE || !isPublicApiUrlConfigured()) {
      setLiveError('unconfigured');
      return;
    }
    setDataSource('live');
    setSelectedNode(null);
    if (!liveGraph) void loadLiveData();
  }, [liveGraph, loadLiveData]);

  // ── Click-to-expand (live KG only) ─────────────────────────────────────────
  // Pull a node's neighbourhood from Oxigraph and merge any new typed entities +
  // real edges into the live graph, so large graphs grow on demand instead of
  // loading everything up front.
  const expandNode = useCallback(
    async (node: GraphNode) => {
      if (dataSource !== 'live' || !API_BASE) return;
      setExpanding(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const token = (session as any)?.accessToken as string | undefined;
        const resp = await fetchKgNeighborhood(API_BASE, node.id, token, { includeLux: 'linked' });
        const add = kgNeighborhoodToGraph(node.id, resp);
        setLiveGraph((prev) => {
          const base = prev ?? { nodes: [], links: [] };
          const nodeIds = new Set(base.nodes.map((n) => n.id));
          const newNodes = add.nodes.filter((n) => !nodeIds.has(n.id));
          const idOf = (x: string | GraphNode) => (typeof x === 'string' ? x : x.id);
          const linkKey = (l: GraphLink) => `${idOf(l.source)}→${idOf(l.target)}→${l.predicate}`;
          const seenLinks = new Set(base.links.map(linkKey));
          const newLinks = add.links.filter((l) => !seenLinks.has(linkKey(l)));
          if (!newNodes.length && !newLinks.length) return prev; // nothing new
          const nodes = [...base.nodes, ...newNodes];
          const links = [...base.links, ...newLinks];
          attachRelations(nodes, links);
          enrichMuseumGraph({ nodes, links });
          return { nodes, links };
        });
      } catch {
        /* expansion is best-effort; ignore transient failures */
      } finally {
        setExpanding(false);
      }
    },
    [dataSource, session],
  );

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

  // Deep-link: ?node=<iri> after graph is available.
  useEffect(() => {
    const nodeParam = searchParams.get('node');
    if (!nodeParam || !fullGraph) return;
    const decoded = decodeURIComponent(nodeParam);
    const match = fullGraph.nodes.find((n) => n.id === decoded);
    if (match) {
      setSelectedNode(match);
      setPanelOpen(true);
      urlSyncedRef.current = true;
    }
  }, [searchParams, fullGraph]);

  // Sync museum state → URL for citable figure links.
  useEffect(() => {
    if (!bootstrappedRef.current) return;
    const p = new URLSearchParams();
    p.set('source', dataSource);
    if (viewMode !== '2d') p.set('view', viewMode);
    if (selectedNode) p.set('node', selectedNode.id);
    const next = `/heritage-museum?${p.toString()}`;
    const current = `/heritage-museum?${searchParams.toString()}`;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [dataSource, viewMode, selectedNode, router, searchParams]);

  const handleExportJson = useCallback(() => {
    if (!filteredGraph) return;
    downloadJson(
      `heritagegraph-museum-${dataSource}-${new Date().toISOString().slice(0, 10)}.json`,
      exportVisibleGraphPayload(filteredGraph, datasetMeta, dataSource),
    );
  }, [filteredGraph, datasetMeta, dataSource]);

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

  const timelineLayout = useMemo(
    () => (filteredGraph ? buildTimelineLayout(filteredGraph.nodes) : null),
    [filteredGraph],
  );
  const showTimeline = Boolean(timelineLayout);

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
      : dataSource === 'live' && datasetMeta
        ? `${t('methods.scopeReviewed')} · ${datasetMeta.nodeCount} nodes · graph ${datasetMeta.graphUri}`
        : dataSource === 'live' && API_BASE
          ? `Live API: ${API_BASE}`
          : null;

  const sparseLive =
    dataSource === 'live' && !liveLoading && !liveError && liveGraph && liveGraph.nodes.length < 20;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">

      {dataSource === 'demo' ? (
        <div
          className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-amber-500/30 bg-amber-500/10 text-xs text-foreground z-20"
          role="status"
        >
          <span>{t('demoBanner')}</span>
          <Button type="button" size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={switchToLive}>
            {t('demoBannerAction')}
          </Button>
        </div>
      ) : null}

      {sparseLive ? (
        <div
          className="flex-shrink-0 px-4 py-2 border-b border-border bg-muted/40 text-xs text-muted-foreground z-20"
          role="status"
        >
          {t('sparseLive', { count: liveGraph.nodes.length })}{' '}
          <Link href="/contribute/entity" className="text-primary underline underline-offset-2">
            {t('sparseLiveContribute')}
          </Link>
          {' · '}
          <Link href="/methods" className="text-primary underline underline-offset-2">
            {t('methods.fullMethodsPage')}
          </Link>
        </div>
      ) : null}

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
        datasetMeta={dataSource === 'live' ? datasetMeta : null}
        onExportJson={dataSource === 'live' ? handleExportJson : undefined}
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

          {/* Grid: graph | story on row 1; timeline pinned to workspace footer (row 2) */}
          <div
            className={cn(
              'grid min-h-0 flex-1',
              viewMode === '2d'
                ? showTimeline
                  ? 'grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(11rem,28vh)] lg:grid-cols-[minmax(0,1fr)_24rem]'
                  : 'grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_24rem]'
                // Map mode: single row. The story panel must be the right COLUMN
                // (lg) — not an implicit stacked row — or it steals the map's
                // height and collapses it to a thin strip.
                : 'grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_24rem]',
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

              {/* View in XR + (live) expand-neighbours buttons */}
              {viewMode === '2d' && !loading && !error && selectedNode && (
                <div className="absolute top-3 right-3 flex gap-2">
                  {dataSource === 'live' && (
                    <Button
                      onClick={() => expandNode(selectedNode)}
                      disabled={expanding}
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1.5"
                      type="button"
                      title="Pull this node's connected entities from the knowledge graph"
                    >
                      {expanding ? 'Expanding…' : '+ Expand'}
                    </Button>
                  )}
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
                dataSource={dataSource}
              />
            </div>

            {/* Timeline: footer band when dated nodes exist (2D only) */}
            {viewMode === '2d' && !loading && !error && (
              <div
                className={cn(
                  'flex flex-shrink-0 flex-col overflow-hidden border-t border-border bg-background lg:col-span-2',
                  showTimeline ? 'min-h-[11rem] max-h-[28vh]' : 'min-h-0',
                )}
              >
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
        <div className="relative flex min-h-0 flex-1">
          <div className="hidden w-52 flex-shrink-0 md:block lg:w-56">
            <PlaceNav
              nodes={filteredGraph?.nodes ?? []}
              selectedId={selectedNode?.id ?? null}
              onSelect={handleNodeSelect}
            />
          </div>
          <div className="relative min-w-0 flex-1">
            {loading ? (
              <MandalaLoader />
            ) : (
              <ImmersiveScene
                node={selectedNode}
                allNodes={filteredGraph?.nodes ?? []}
                onSelect={handleNodeSelect}
                dataSource={dataSource}
              />
            )}
            <div className="absolute left-3 top-3 z-30 flex flex-wrap items-center gap-2">
              <Button
                onClick={() => setViewMode('2d')}
                type="button"
                variant="secondary"
                size="sm"
                className="text-xs shadow-sm"
              >
                {t('backToGraph')}
              </Button>
              {dataSource === 'live' && !loading ? (
                <Badge className="gap-1.5 text-[10px] font-semibold shadow-sm">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
                  {t('liveBadge')}
                </Badge>
              ) : null}
            </div>
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
                dataSource={dataSource}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
