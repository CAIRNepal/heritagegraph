'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconSearch,
  IconZoomIn,
  IconZoomOut,
  IconFocus2,
  IconDownload,
  IconInfoCircle,
  IconX,
  IconLayoutGrid,
  IconFilter,
  IconChevronRight,
  IconDatabase,
  IconSchema,
  IconRefresh,
  IconLoader2,
  IconLayout,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fadeInUp, staggerContainer, glassCard } from '@/lib/design';
import { cn } from '@/lib/utils';
import {
  getOntologyGraphData,
  CATEGORY_COLORS,
  getEdgesForNode,
  type OntologyNode,
  type OntologyCategory,
} from '@/lib/ontology-graph';
import {
  fetchInstanceGraphData,
  fetchForkEdges,
  mergeForkData,
  getInstanceStats,
  INSTANCE_CATEGORY_COLORS,
  type InstanceNode,
  type InstanceCategory,
  type InstanceGraphData,
} from '@/lib/instance-graph';
import { getApiErrorMessage } from '@/lib/api-client';

/* ── Cytoscape is client-only ── */
/* eslint-disable @typescript-eslint/no-explicit-any */
let cytoscapeReady = false;
let cytoscape: any = null;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/* ── Layout presets (internal ids; UI uses visitor labels) ── */
const LAYOUTS: Record<string, any> = {
  'cose-bilkent': {
    name: 'cose-bilkent',
    animate: true,
    animationDuration: 800,
    idealEdgeLength: 130,
    nodeRepulsion: 8500,
    edgeElasticity: 0.45,
    nestingFactor: 0.1,
    gravity: 0.25,
    tile: true,
    tilingPaddingVertical: 30,
    tilingPaddingHorizontal: 30,
    fit: true,
    padding: 40,
  },
  cola: {
    name: 'cola',
    animate: true,
    maxSimulationTime: 4000,
    nodeSpacing: 35,
    edgeLength: 150,
    fit: true,
    padding: 40,
  },
  concentric: {
    name: 'concentric',
    animate: true,
    minNodeSpacing: 60,
    concentric: (node: any) => node.degree(),
    levelWidth: () => 3,
    fit: true,
    padding: 40,
  },
  breadthfirst: {
    name: 'breadthfirst',
    animate: true,
    directed: true,
    spacingFactor: 1.25,
    fit: true,
    padding: 40,
  },
};

const LAYOUT_OPTIONS: { id: string; label: string; hint: string }[] = [
  { id: 'cose-bilkent', label: 'Natural', hint: 'Force-directed clusters' },
  { id: 'cola', label: 'Spacious', hint: 'More breathing room' },
  { id: 'concentric', label: 'Radial', hint: 'Hubs at the centre' },
  { id: 'breadthfirst', label: 'Tree', hint: 'Hierarchy top-down' },
];

/* ── View mode ── */
type ViewMode = 'ontology' | 'instance';

/* ══════════════════════════════════════════════════════
 *  Component
 * ══════════════════════════════════════════════════════ */
export default function GraphViewPage() {
  const { data: session } = useSession();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  // Schema first — ontology is the default research entry; Heritage is one click away.
  const [viewMode, setViewMode] = useState<ViewMode>('ontology');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayout, setActiveLayout] = useState('cose-bilkent');
  const [showFilters, setShowFilters] = useState(true);

  // Ontology mode state
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<OntologyCategory>>(
    new Set(Object.keys(CATEGORY_COLORS) as OntologyCategory[]),
  );

  // Instance mode state
  const [instanceData, setInstanceData] = useState<InstanceGraphData | null>(null);
  const [instanceLoading, setInstanceLoading] = useState(false);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const [showForkEdges, setShowForkEdges] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<InstanceNode | null>(null);
  const [activeInstanceCategories, setActiveInstanceCategories] = useState<Set<InstanceCategory>>(
    new Set(Object.keys(INSTANCE_CATEGORY_COLORS) as InstanceCategory[]),
  );

  const graphData = useMemo(() => getOntologyGraphData(), []);

  /* ── Stats ── */
  const ontologyStats = useMemo(
    () => ({
      classes: graphData.nodes.length,
      relationships: graphData.edges.filter((e) => e.edgeType === 'object_property').length,
      hierarchyEdges: graphData.edges.filter((e) => e.edgeType === 'is_a').length,
      categories: new Set(graphData.nodes.map((n) => n.category)).size,
    }),
    [graphData],
  );

  const instanceStats = useMemo(
    () => (instanceData ? getInstanceStats(instanceData) : null),
    [instanceData],
  );

  /* ── Load Cytoscape extensions once ── */
  const ensureCytoscape = useCallback(async () => {
    if (cytoscapeReady) return;
    const [cyMod, coseMod, colaMod] = await Promise.all([
      import('cytoscape'),
      import('cytoscape-cose-bilkent'),
      import('cytoscape-cola'),
    ]);
    cytoscape = cyMod.default;
    const coseBilkent = coseMod.default;
    const cola = colaMod.default;
    if (typeof coseBilkent === 'function') cytoscape.use(coseBilkent);
    if (typeof cola === 'function') cytoscape.use(cola);
    cytoscapeReady = true;
  }, []);

  /* ── Build and mount ontology graph ── */
  const mountOntologyGraph = useCallback(() => {
    if (!cytoscape || !containerRef.current) return;
    cyRef.current?.destroy();

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildOntologyElements(graphData),
      style: buildOntologyStyles(),
      layout: LAYOUTS['cose-bilkent'],
      minZoom: 0.2,
      maxZoom: 4,
      wheelSensitivity: 0.3,
    });

    cy.on('tap', 'node', (evt: any) => {
      const id = evt.target.id();
      const node = graphData.nodes.find((n: OntologyNode) => n.id === id);
      if (node) setSelectedNode(node);
      setSelectedInstance(null);
      highlightNeighbors(cy, id);
    });

    cy.on('tap', (evt: any) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        resetHighlight(cy);
      }
    });

    cyRef.current = cy;
    setReady(true);
  }, [graphData]);

  /* ── Build and mount instance graph ── */
  const mountInstanceGraph = useCallback(
    (data: InstanceGraphData) => {
      if (!cytoscape || !containerRef.current) return;
      cyRef.current?.destroy();

      const nodeCount = data.nodes.length;
      // For larger graphs, use lighter layout settings
      const instanceLayout = nodeCount > 80
        ? {
            ...LAYOUTS['cose-bilkent'],
            animate: false,           // skip animation for speed
            idealEdgeLength: 100,
            nodeRepulsion: 12000,     // more spacing
            gravity: 0.15,
          }
        : LAYOUTS['cose-bilkent'];

      const cy = cytoscape({
        container: containerRef.current,
        elements: buildInstanceElements(data),
        style: buildInstanceStyles(),
        layout: instanceLayout,
        minZoom: 0.1,
        maxZoom: 5,
        wheelSensitivity: 0.3,
        textureOnViewport: nodeCount > 100,  // GPU texture caching for larger graphs
        hideEdgesOnViewport: nodeCount > 150, // hide edges while panning for performance
        hideLabelsOnViewport: nodeCount > 200, // hide labels while panning
      });

      cy.on('tap', 'node', (evt: any) => {
        const id = evt.target.id();
        const node = data.nodes.find((n) => n.id === id);
        if (node) setSelectedInstance(node);
        setSelectedNode(null);
        highlightNeighbors(cy, id);
      });

      cy.on('tap', (evt: any) => {
        if (evt.target === cy) {
          setSelectedInstance(null);
          resetHighlight(cy);
        }
      });

      // After layout finishes, set degree data for size mapping
      cy.on('layoutstop', () => {
        cy.batch(() => {
          cy.nodes().forEach((n: any) => {
            n.data('degree', n.degree());
          });
        });
      });

      cyRef.current = cy;
      setReady(true);
    },
    [],
  );

  /* ── Fetch instance data ── */
  const loadInstanceData = useCallback(async () => {
    setInstanceLoading(true);
    setInstanceError(null);
    try {
      const token = (session as any)?.accessToken;
      const [baseData, forkData] = await Promise.all([
        fetchInstanceGraphData(API_BASE_URL, token),
        fetchForkEdges(API_BASE_URL, token),
      ]);
      const data = showForkEdges
        ? mergeForkData(baseData, forkData)
        : baseData;
      setInstanceData(data);
      return data;
    } catch (err: unknown) {
      setInstanceError(
        getApiErrorMessage(err, 'Could not load the live graph. Try again or check your connection.')
      );
      return null;
    } finally {
      setInstanceLoading(false);
    }
  }, [session, showForkEdges]);

  /* ── Initial load: ontology schema ── */
  useEffect(() => {
    let mounted = true;

    async function init() {
      await ensureCytoscape();
      if (!mounted) return;
      mountOntologyGraph();
    }

    init();
    return () => {
      mounted = false;
      cyRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Switch between views ── */
  const switchView = useCallback(
    async (mode: ViewMode) => {
      setViewMode(mode);
      setSelectedNode(null);
      setSelectedInstance(null);
      setSearchQuery('');
      setReady(false);

      if (mode === 'ontology') {
        mountOntologyGraph();
      } else {
        let data = instanceData;
        if (!data) {
          data = await loadInstanceData();
        }
        if (data && data.nodes.length > 0) {
          mountInstanceGraph(data);
        } else {
          setReady(true);
        }
      }
    },
    [instanceData, mountOntologyGraph, mountInstanceGraph, loadInstanceData],
  );

  /* ── Refresh instance data ── */
  const refreshInstanceData = useCallback(async () => {
    setReady(false);
    const data = await loadInstanceData();
    if (data && data.nodes.length > 0) {
      mountInstanceGraph(data);
    } else {
      setReady(true);
    }
  }, [loadInstanceData, mountInstanceGraph]);

  /* ── Refresh when fork toggle changes ── */
  useEffect(() => {
    if (viewMode === 'instance' && cyRef.current) {
      refreshInstanceData();
    }
  }, [showForkEdges]);

  /* ── Filter by category ── */
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;

    if (viewMode === 'ontology') {
      cy.batch(() => {
        cy.nodes().forEach((n: any) => {
          const c = n.data('category') as OntologyCategory;
          n.style('display', activeCategories.has(c) ? 'element' : 'none');
        });
      });
    } else {
      cy.batch(() => {
        cy.nodes().forEach((n: any) => {
          const c = n.data('category') as InstanceCategory;
          n.style('display', activeInstanceCategories.has(c) ? 'element' : 'none');
        });
      });
    }
  }, [activeCategories, activeInstanceCategories, viewMode]);

  /* ── Search highlight ── */
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (!searchQuery.trim()) {
      resetHighlight(cy);
      return;
    }
    const q = searchQuery.toLowerCase();
    cy.batch(() => {
      cy.elements().removeClass('highlighted faded searched');
      const matched = cy.nodes().filter((n: any) => {
        const label = (n.data('label') as string || '').toLowerCase();
        const id = (n.data('id') as string || '').toLowerCase();
        return label.includes(q) || id.includes(q);
      });
      if (matched.length > 0) {
        cy.elements().addClass('faded');
        matched.addClass('searched').removeClass('faded');
        matched.connectedEdges().addClass('highlighted').removeClass('faded');
        matched.connectedEdges().connectedNodes().removeClass('faded');
        cy.animate({ fit: { eles: matched, padding: 60 }, duration: 600 });
      }
    });
  }, [searchQuery]);

  /* ── Layout change ── */
  const runLayout = useCallback((name: string) => {
    if (!cyRef.current) return;
    setActiveLayout(name);
    cyRef.current.layout(LAYOUTS[name] || LAYOUTS['cose-bilkent']).run();
  }, []);

  /* ── Controls ── */
  const zoomIn = () =>
    cyRef.current?.animate({
      zoom: { level: cyRef.current.zoom() * 1.3, position: cyRef.current.extent().center() },
      duration: 300,
    });
  const zoomOut = () =>
    cyRef.current?.animate({
      zoom: { level: cyRef.current.zoom() / 1.3, position: cyRef.current.extent().center() },
      duration: 300,
    });
  const fitAll = () => cyRef.current?.animate({ fit: { padding: 40 }, duration: 500 });

  const exportPng = () => {
    if (!cyRef.current) return;
    const png = cyRef.current.png({ full: true, scale: 2, bg: '#ffffff' });
    const a = document.createElement('a');
    a.href = png;
    a.download = viewMode === 'ontology' ? 'HeritageGraph_Ontology.png' : 'HeritageGraph_Data.png';
    a.click();
  };

  const toggleOntologyCategory = (cat: OntologyCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleInstanceCategory = (cat: InstanceCategory) => {
    setActiveInstanceCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  /* ── Edges for detail panels ── */
  const selectedEdges = useMemo(
    () => (selectedNode ? getEdgesForNode(selectedNode.id) : []),
    [selectedNode],
  );

  const selectedInstanceEdges = useMemo(() => {
    if (!selectedInstance || !instanceData) return [];
    return instanceData.edges.filter(
      (e) => e.source === selectedInstance.id || e.target === selectedInstance.id,
    );
  }, [selectedInstance, instanceData]);

  const layoutLabel =
    LAYOUT_OPTIONS.find((o) => o.id === activeLayout)?.label ?? 'Natural';

  const clearSelection = () => {
    setSelectedNode(null);
    setSelectedInstance(null);
    if (cyRef.current) resetHighlight(cyRef.current);
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* ── Slim header ── */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={staggerContainer}
        className={cn(glassCard, 'relative overflow-hidden p-4')}
      >
        <motion.div variants={fadeInUp} className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
              Knowledge Graph
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
              {viewMode === 'instance' ? (
                <>
                  Explore how heritage records connect.
                  {instanceStats
                    ? ` ${instanceStats.totalEntities} entities · ${instanceStats.totalRelationships} links.`
                    : instanceLoading
                      ? ' Loading…'
                      : ''}
                  {' '}Click a node to inspect it.
                </>
              ) : (
                <>
                  Schema of the HeritageGraph ontology — {ontologyStats.classes} classes and{' '}
                  {ontologyStats.relationships} properties. For researchers mapping the model.
                </>
              )}
            </p>
          </div>

          <Tabs
            value={viewMode}
            onValueChange={(v) => void switchView(v as ViewMode)}
            className="shrink-0"
          >
            <TabsList className="h-9">
              <TabsTrigger value="ontology" className="gap-1.5 text-xs px-3">
                <IconSchema className="w-3.5 h-3.5" aria-hidden />
                Schema
              </TabsTrigger>
              <TabsTrigger value="instance" className="gap-1.5 text-xs px-3">
                <IconDatabase className="w-3.5 h-3.5" aria-hidden />
                Heritage
                {instanceStats ? (
                  <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                    {instanceStats.totalEntities}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>
      </motion.div>

      {/* ── Toolbar ── */}
      <div className={cn(glassCard, 'flex flex-wrap items-center gap-2 p-3')}>
        <div className="relative min-w-[200px] max-w-xs flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            placeholder={viewMode === 'ontology' ? 'Search classes…' : 'Search entities…'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={viewMode === 'ontology' ? 'Search ontology classes' : 'Search heritage entities'}
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <IconLayout className="h-3.5 w-3.5" aria-hidden />
              Layout: {layoutLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Arrangement
            </p>
            <div className="space-y-0.5">
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => runLayout(opt.id)}
                  className={cn(
                    'flex w-full flex-col rounded-lg px-2.5 py-1.5 text-left transition-colors',
                    activeLayout === opt.id
                      ? 'bg-primary/12 text-primary'
                      : 'hover:bg-muted/60 text-foreground',
                  )}
                >
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFilters((p) => !p)}
          className="gap-1 text-xs"
          aria-pressed={showFilters}
        >
          <IconFilter className="h-3.5 w-3.5" aria-hidden />
          Categories
        </Button>

        {viewMode === 'instance' ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshInstanceData}
              disabled={instanceLoading}
              className="gap-1 text-xs"
            >
              {instanceLoading ? (
                <IconLoader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <IconRefresh className="h-3.5 w-3.5" aria-hidden />
              )}
              Refresh
            </Button>
            <Button
              variant={showForkEdges ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowForkEdges((prev) => !prev)}
              className="gap-1 text-xs"
              aria-pressed={showForkEdges}
            >
              {showForkEdges ? 'Forks shown' : 'Show forks'}
            </Button>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} aria-label="Zoom in">
            <IconZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} aria-label="Zoom out">
            <IconZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fitAll} aria-label="Fit all">
            <IconFocus2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportPng} aria-label="Export PNG">
            <IconDownload className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Category chips (legend + filter) ── */}
      {showFilters ? (
        <div className={cn(glassCard, 'p-3')} role="group" aria-label="Category filters">
          <div className="flex flex-wrap gap-1.5">
            {viewMode === 'ontology'
              ? (Object.entries(CATEGORY_COLORS) as [OntologyCategory, (typeof CATEGORY_COLORS)[OntologyCategory]][]).map(
                  ([key, val]) => {
                    const on = activeCategories.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleOntologyCategory(key)}
                        aria-pressed={on}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                          on
                            ? 'border-transparent text-white shadow-sm'
                            : 'border-border bg-muted/40 text-muted-foreground opacity-70',
                        )}
                        style={on ? { backgroundColor: val.bg, borderColor: val.border } : undefined}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: val.bg }} aria-hidden />
                        {val.label}
                      </button>
                    );
                  },
                )
              : (Object.entries(INSTANCE_CATEGORY_COLORS) as [InstanceCategory, (typeof INSTANCE_CATEGORY_COLORS)[InstanceCategory]][]).map(
                  ([key, val]) => {
                    const on = activeInstanceCategories.has(key);
                    const count = instanceStats?.byCategory[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleInstanceCategory(key)}
                        aria-pressed={on}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                          on
                            ? 'border-transparent text-white shadow-sm'
                            : 'border-border bg-muted/40 text-muted-foreground opacity-70',
                        )}
                        style={on ? { backgroundColor: val.bg, borderColor: val.border } : undefined}
                      >
                        <span aria-hidden>{val.icon}</span>
                        {val.label}
                        {count != null ? (
                          <span className="font-mono text-[10px] opacity-80">{count}</span>
                        ) : null}
                      </button>
                    );
                  },
                )}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {viewMode === 'ontology'
              ? 'Solid edges = class hierarchy · Dashed = object properties'
              : 'Solid = relationship · Dashed green = co-located · Dashed purple = fork'}
          </p>
        </div>
      ) : null}

      {/* ── Main Grid: Graph + Detail Panel ── */}
      <div className="flex min-h-[400px] gap-3 h-[calc(100vh-280px)]">
        {/* Graph canvas */}
        <div className={cn('relative min-w-0 flex-1 overflow-hidden', glassCard)}>
          {(!ready || instanceLoading) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <IconLoader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                <p className="text-sm font-medium text-foreground">
                  {instanceLoading ? 'Fetching heritage data…' : 'Preparing graph…'}
                </p>
              </div>
            </div>
          )}

          {viewMode === 'instance' && ready && !instanceLoading && instanceData?.nodes.length === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="max-w-sm space-y-3 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <IconDatabase className="h-7 w-7 text-muted-foreground" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No heritage records yet</h3>
                <p className="text-sm text-muted-foreground">
                  Contribute a record, then refresh — the graph fills as the corpus grows.
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="/contribute">Contribute</a>
                  </Button>
                  <Button variant="outline" size="sm" onClick={refreshInstanceData} className="gap-1.5">
                    <IconRefresh className="h-3.5 w-3.5" aria-hidden />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'instance' && instanceError ? (
            <div className="absolute left-3 right-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <span className="flex-1">{instanceError}</span>
              <Button variant="ghost" size="sm" onClick={refreshInstanceData} className="text-xs">
                Retry
              </Button>
            </div>
          ) : null}

          <div ref={containerRef} className="h-full w-full" />
        </div>

        {/* Detail / empty guidance */}
        <AnimatePresence mode="wait">
          {selectedNode && viewMode === 'ontology' ? (
            <motion.div
              key={`onto-${selectedNode.id}`}
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn('w-80 shrink-0 overflow-y-auto p-4', glassCard)}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[selectedNode.category].bg }}
                    aria-hidden
                  />
                  <h3 className="text-lg font-semibold text-foreground">{selectedNode.label}</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearSelection} aria-label="Close">
                  <IconX className="h-4 w-4" />
                </Button>
              </div>

              <Badge variant="secondary" className="mb-3 text-xs">
                {CATEGORY_COLORS[selectedNode.category].label}
              </Badge>

              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{selectedNode.description}</p>

              <details className="mb-4 rounded-lg border border-border bg-muted/30">
                <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Schema mapping
                </summary>
                <div className="space-y-2 border-t border-border px-3 pb-3 pt-2">
                  <div className="break-all rounded-md bg-muted px-2.5 py-2 font-mono text-xs text-foreground">
                    {selectedNode.cidocMapping}
                  </div>
                  {selectedNode.parent ? (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Parent:</span>{' '}
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          const parent = graphData.nodes.find((n) => n.id === selectedNode.parent);
                          if (parent) {
                            setSelectedNode(parent);
                            if (cyRef.current) highlightNeighbors(cyRef.current, parent.id);
                          }
                        }}
                      >
                        {selectedNode.parent}
                      </button>
                    </div>
                  ) : null}
                </div>
              </details>

              <div className="space-y-2">
                <h4 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <IconLayoutGrid className="h-3.5 w-3.5" aria-hidden />
                  Relationships ({selectedEdges.length})
                </h4>
                <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
                  {selectedEdges.map((e) => {
                    const isOutgoing = e.source === selectedNode.id;
                    const otherNodeId = isOutgoing ? e.target : e.source;
                    const otherNode = graphData.nodes.find((n) => n.id === otherNodeId);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        className="group flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
                        onClick={() => {
                          if (otherNode) {
                            setSelectedNode(otherNode);
                            if (cyRef.current) highlightNeighbors(cyRef.current, otherNode.id);
                          }
                        }}
                      >
                        <IconChevronRight
                          className={cn(
                            'h-3 w-3 shrink-0 text-muted-foreground transition-transform',
                            !isOutgoing && 'rotate-180',
                          )}
                          aria-hidden
                        />
                        <span className="flex-1 truncate font-mono text-primary">{e.label}</span>
                        <span className="max-w-[100px] truncate text-muted-foreground">
                          {otherNode?.label ?? otherNodeId}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ) : selectedInstance && viewMode === 'instance' ? (
            <motion.div
              key={`inst-${selectedInstance.id}`}
              initial={{ x: 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn('w-80 shrink-0 overflow-y-auto p-4', glassCard)}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm"
                    style={{ backgroundColor: INSTANCE_CATEGORY_COLORS[selectedInstance.category].bg }}
                    aria-hidden
                  >
                    {INSTANCE_CATEGORY_COLORS[selectedInstance.category].icon}
                  </span>
                  <h3 className="text-lg font-semibold text-foreground">{selectedInstance.label}</h3>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearSelection} aria-label="Close">
                  <IconX className="h-4 w-4" />
                </Button>
              </div>

              <Badge
                variant="secondary"
                className="mb-3 text-xs"
                style={{
                  backgroundColor: `${INSTANCE_CATEGORY_COLORS[selectedInstance.category].bg}20`,
                  color: INSTANCE_CATEGORY_COLORS[selectedInstance.category].bg,
                  borderColor: `${INSTANCE_CATEGORY_COLORS[selectedInstance.category].bg}40`,
                }}
              >
                {selectedInstance.entityType}
              </Badge>

              {selectedInstance.description ? (
                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{selectedInstance.description}</p>
              ) : null}

              <details className="mb-4 rounded-lg border border-border bg-muted/30">
                <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Record fields
                </summary>
                <div className="space-y-1.5 border-t border-border px-3 pb-3 pt-2">
                  {Object.entries(selectedInstance.rawData)
                    .filter(
                      ([k, v]) =>
                        v &&
                        typeof v !== 'object' &&
                        !['id', 'created_at', 'title', 'description', 'contributor', 'status'].includes(k),
                    )
                    .slice(0, 12)
                    .map(([key, value]) => (
                      <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="min-w-[80px] shrink-0 font-medium text-muted-foreground">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="break-words text-foreground">{String(value).slice(0, 100)}</span>
                      </div>
                    ))}
                </div>
              </details>

              {selectedInstanceEdges.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <IconLayoutGrid className="h-3.5 w-3.5" aria-hidden />
                    Connections ({selectedInstanceEdges.length})
                  </h4>
                  <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
                    {selectedInstanceEdges.map((e) => {
                      const isOutgoing = e.source === selectedInstance.id;
                      const otherNodeId = isOutgoing ? e.target : e.source;
                      const otherNode = instanceData?.nodes.find((n) => n.id === otherNodeId);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
                          onClick={() => {
                            if (otherNode) {
                              setSelectedInstance(otherNode);
                              if (cyRef.current) highlightNeighbors(cyRef.current, otherNode.id);
                            }
                          }}
                        >
                          <IconChevronRight
                            className={cn('h-3 w-3 shrink-0 text-muted-foreground', !isOutgoing && 'rotate-180')}
                            aria-hidden
                          />
                          <span className="flex-1 truncate font-mono text-primary">{e.label}</span>
                          <span className="max-w-[100px] truncate text-muted-foreground">
                            {otherNode?.label ?? otherNodeId}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 border-t border-border pt-3">
                <a
                  href={`/knowledge/${selectedInstance.category}/view/${selectedInstance.rawData.id}`}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <IconChevronRight className="h-3 w-3" aria-hidden />
                  Open full record
                </a>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                'hidden w-72 shrink-0 flex-col items-center justify-center gap-3 p-6 text-center lg:flex',
                glassCard,
              )}
            >
              <IconInfoCircle className="h-8 w-8 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground">Select a node</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {viewMode === 'instance'
                  ? 'Click any entity to read its story and follow connections.'
                  : 'Click a class to see hierarchy, mappings, and properties.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
 *  Ontology graph helpers
 * ═══════════════════════════════════════════════════════ */

function buildOntologyElements(data: ReturnType<typeof getOntologyGraphData>) {
  const nodes = data.nodes.map((n) => ({
    data: {
      id: n.id,
      label: n.label,
      category: n.category,
      cidocMapping: n.cidocMapping,
      description: n.description,
      color: CATEGORY_COLORS[n.category].bg,
      borderColor: CATEGORY_COLORS[n.category].border,
    },
  }));
  const edges = data.edges.map((e) => ({
    data: { id: e.id, source: e.source, target: e.target, label: e.label, edgeType: e.edgeType },
  }));
  return [...nodes, ...edges];
}

function buildOntologyStyles(): any[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)', 'border-color': 'data(borderColor)', 'border-width': 2,
        label: 'data(label)', color: '#1e3a5f', 'font-size': '10px', 'font-weight': 600,
        'text-valign': 'bottom', 'text-halign': 'center', 'text-margin-y': 6,
        'text-wrap': 'ellipsis', 'text-max-width': '100px', width: 32, height: 32, shape: 'ellipse',
        'overlay-padding': 4, 'transition-property': 'background-color, border-color, width, height, opacity',
        'transition-duration': '0.25s',
      },
    },
    {
      selector: 'edge[edgeType="is_a"]',
      style: {
        'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.8,
        'line-color': '#94a3b8', 'target-arrow-color': '#94a3b8', width: 1.5, 'line-style': 'solid',
        opacity: 0.7, 'transition-property': 'opacity, line-color', 'transition-duration': '0.25s',
      },
    },
    {
      selector: 'edge[edgeType="object_property"]',
      style: {
        'curve-style': 'bezier', 'target-arrow-shape': 'vee', 'arrow-scale': 0.7,
        'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6', width: 1, 'line-style': 'dashed',
        'line-dash-pattern': [6, 3], opacity: 0.4, label: 'data(label)', 'font-size': '7px',
        color: '#64748b', 'text-rotation': 'autorotate', 'text-margin-y': -8,
        'transition-property': 'opacity, line-color', 'transition-duration': '0.25s',
      },
    },
    ...sharedInteractionStyles(),
  ];
}

/* ═══════════════════════════════════════════════════════
 *  Instance graph helpers
 * ═══════════════════════════════════════════════════════ */

function buildInstanceElements(data: InstanceGraphData) {
  const nodes = data.nodes.map((n) => ({
    data: {
      id: n.id, label: n.label, category: n.category, entityType: n.entityType,
      description: n.description, color: INSTANCE_CATEGORY_COLORS[n.category].bg,
      borderColor: INSTANCE_CATEGORY_COLORS[n.category].border,
    },
  }));
  const edges = data.edges.map((e) => ({
    data: { id: e.id, source: e.source, target: e.target, label: e.label, edgeType: e.edgeType },
  }));
  return [...nodes, ...edges];
}

function buildInstanceStyles(): any[] {
  return [
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)', 'border-color': 'data(borderColor)', 'border-width': 2,
        label: 'data(label)', color: '#1e3a5f', 'font-size': '10px', 'font-weight': 600,
        'text-valign': 'bottom', 'text-halign': 'center', 'text-margin-y': 6,
        'text-wrap': 'ellipsis', 'text-max-width': '110px',
        // Degree-based sizing: more connections = larger node
        width: 'mapData(degree, 0, 15, 28, 56)',
        height: 'mapData(degree, 0, 15, 28, 56)',
        shape: 'ellipse',
        'overlay-padding': 4, 'transition-property': 'background-color, border-color, width, height, opacity',
        'transition-duration': '0.25s',
        'min-zoomed-font-size': 8, // hide labels when zoomed out far
      },
    },
    {
      selector: 'edge[edgeType="relation"]',
      style: {
        'curve-style': 'bezier', 'target-arrow-shape': 'vee', 'arrow-scale': 0.8,
        'line-color': '#3b82f6', 'target-arrow-color': '#3b82f6', width: 1.5, 'line-style': 'solid',
        opacity: 0.5, label: 'data(label)', 'font-size': '7px', color: '#64748b',
        'text-rotation': 'autorotate', 'text-margin-y': -8,
        'min-zoomed-font-size': 10,
        'transition-property': 'opacity, line-color', 'transition-duration': '0.25s',
      },
    },
    {
      selector: 'edge[edgeType="location"]',
      style: {
        'curve-style': 'bezier', 'target-arrow-shape': 'vee', 'arrow-scale': 0.6,
        'line-color': '#10b981', 'target-arrow-color': '#10b981', width: 1, 'line-style': 'dashed',
        'line-dash-pattern': [4, 4], opacity: 0.35, label: 'data(label)', 'font-size': '7px',
        color: '#059669', 'text-rotation': 'autorotate', 'text-margin-y': -8,
        'min-zoomed-font-size': 10,
        'transition-property': 'opacity, line-color', 'transition-duration': '0.25s',
      },
    },
    {
      selector: 'edge[edgeType="fork"]',
      style: {
        'curve-style': 'bezier', 'target-arrow-shape': 'triangle', 'arrow-scale': 0.7,
        'line-color': '#a855f7', 'target-arrow-color': '#a855f7', width: 1.5,
        'line-style': 'dashed', 'line-dash-pattern': [6, 3],
        opacity: 0.6, label: 'fork', 'font-size': '7px',
        color: '#9333ea', 'text-rotation': 'autorotate', 'text-margin-y': -8,
        'min-zoomed-font-size': 10,
        'transition-property': 'opacity, line-color', 'transition-duration': '0.25s',
      },
    },
    ...sharedInteractionStyles(),
  ];
}

/* ═══════════════════════════════════════════════════════
 *  Shared interaction styles
 * ═══════════════════════════════════════════════════════ */

function sharedInteractionStyles(): any[] {
  return [
    { selector: '.highlighted', style: { opacity: 1 } },
    { selector: 'node.highlighted', style: { width: 42, height: 42, 'border-width': 3, 'font-size': '12px', 'font-weight': 700 } },
    { selector: '.faded', style: { opacity: 0.12 } },
    { selector: 'node.searched', style: { width: 46, height: 46, 'border-width': 4, 'border-color': '#f59e0b', 'font-size': '13px', 'font-weight': 700, opacity: 1 } },
  ];
}

function highlightNeighbors(cy: any, nodeId: string) {
  cy.batch(() => {
    cy.elements().removeClass('highlighted searched').addClass('faded');
    const node = cy.getElementById(nodeId);
    const neighborhood = node.closedNeighborhood();
    neighborhood.removeClass('faded').addClass('highlighted');
  });
}

function resetHighlight(cy: any) {
  cy.batch(() => { cy.elements().removeClass('highlighted faded searched'); });
}
