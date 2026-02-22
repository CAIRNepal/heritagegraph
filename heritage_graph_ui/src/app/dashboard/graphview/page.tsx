'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
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
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fadeInUp, staggerContainer, glassCard, heroGradient } from '@/lib/design';
import {
  getOntologyGraphData,
  CATEGORY_COLORS,
  getEdgesForNode,
  type OntologyNode,
  type OntologyCategory,
} from '@/lib/ontology-graph';

/* ── Cytoscape is client-only ── */
/* eslint-disable @typescript-eslint/no-explicit-any */
let cytoscapeReady = false;
let cytoscape: any = null;

/* ── Layout presets ── */
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

/* ── Component ── */
export default function GraphViewPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [selectedNode, setSelectedNode] = useState<OntologyNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLayout, setActiveLayout] = useState('cose-bilkent');
  const [activeCategories, setActiveCategories] = useState<Set<OntologyCategory>>(
    new Set(Object.keys(CATEGORY_COLORS) as OntologyCategory[]),
  );
  const [showFilters, setShowFilters] = useState(false);

  const graphData = useMemo(() => getOntologyGraphData(), []);

  /* ── Stats ── */
  const stats = useMemo(
    () => ({
      classes: graphData.nodes.length,
      relationships: graphData.edges.filter((e) => e.edgeType === 'object_property').length,
      hierarchyEdges: graphData.edges.filter((e) => e.edgeType === 'is_a').length,
      categories: new Set(graphData.nodes.map((n) => n.category)).size,
    }),
    [graphData],
  );

  /* ── Initialise Cytoscape ── */
  useEffect(() => {
    let mounted = true;

    async function init() {
      const [cyMod, coseMod, colaMod] = await Promise.all([
        import('cytoscape'),
        import('cytoscape-cose-bilkent'),
        import('cytoscape-cola'),
      ]);

      cytoscape = cyMod.default;
      const coseBilkent = coseMod.default;
      const cola = colaMod.default;

      if (!cytoscapeReady) {
        if (typeof coseBilkent === 'function') cytoscape.use(coseBilkent);
        if (typeof cola === 'function') cytoscape.use(cola);
        cytoscapeReady = true;
      }

      if (!mounted || !containerRef.current) return;

      const cy = cytoscape({
        container: containerRef.current,
        elements: buildElements(graphData),
        style: buildStyles(),
        layout: LAYOUTS['cose-bilkent'],
        minZoom: 0.2,
        maxZoom: 4,
        wheelSensitivity: 0.3,
      });

      /* ── Interaction ── */
      cy.on('tap', 'node', (evt: any) => {
        const id = evt.target.id();
        const node = graphData.nodes.find((n: OntologyNode) => n.id === id);
        if (node) setSelectedNode(node);
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
    }

    init();
    return () => {
      mounted = false;
      cyRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Filter by category ── */
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    cy.batch(() => {
      cy.nodes().forEach((n: any) => {
        const cat = n.data('category') as OntologyCategory;
        if (activeCategories.has(cat)) {
          n.style('display', 'element');
        } else {
          n.style('display', 'none');
        }
      });
    });
  }, [activeCategories]);

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
  const runLayout = useCallback(
    (name: string) => {
      if (!cyRef.current) return;
      setActiveLayout(name);
      cyRef.current.layout(LAYOUTS[name] || LAYOUTS['cose-bilkent']).run();
    },
    [],
  );

  /* ── Zoom controls ── */
  const zoomIn = () => cyRef.current?.animate({ zoom: { level: cyRef.current.zoom() * 1.3, position: cyRef.current.extent().center() }, duration: 300 });
  const zoomOut = () => cyRef.current?.animate({ zoom: { level: cyRef.current.zoom() / 1.3, position: cyRef.current.extent().center() }, duration: 300 });
  const fitAll = () => cyRef.current?.animate({ fit: { padding: 40 }, duration: 500 });

  /* ── Export PNG ── */
  const exportPng = () => {
    if (!cyRef.current) return;
    const png = cyRef.current.png({ full: true, scale: 2, bg: '#ffffff' });
    const a = document.createElement('a');
    a.href = png;
    a.download = 'HeritageGraph_Ontology.png';
    a.click();
  };

  /* ── Toggle category ── */
  const toggleCategory = (cat: OntologyCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  /* ── Neighbour edges for detail panel ── */
  const selectedEdges = useMemo(
    () => (selectedNode ? getEdgesForNode(selectedNode.id) : []),
    [selectedNode],
  );

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <motion.div initial="hidden" animate="show" variants={staggerContainer} className={`relative overflow-hidden ${glassCard} p-6 md:p-8`}>
        <div className={`absolute inset-0 ${heroGradient}`} />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <motion.div variants={fadeInUp} className="relative z-10 space-y-2">
          <h1 className="text-2xl md:text-3xl font-black text-white">
            Ontology{' '}
            <span className="bg-gradient-to-r from-white via-blue-100 to-sky-100 bg-clip-text text-transparent">
              Knowledge Graph
            </span>
          </h1>
          <p className="text-blue-100 max-w-3xl text-sm md:text-base leading-relaxed">
            Interactive visualisation of the HeritageGraph ontology — {stats.classes} classes,{' '}
            {stats.relationships} object properties, and {stats.hierarchyEdges} class-hierarchy
            relationships aligned with CIDOC-CRM, PROV-O, and domain-specific extensions.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {(['CIDOC-CRM', 'PROV-O', 'Getty AAT', 'GeoSPARQL', 'LinkML'] as const).map((t) => (
              <span key={t} className="px-2.5 py-0.5 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full text-xs font-medium text-white">
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* ── Toolbar ── */}
      <div className={`${glassCard} p-3 flex flex-wrap items-center gap-2`}>
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
          <input
            type="text"
            placeholder="Search classes…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-blue-50 dark:bg-gray-800 border border-blue-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Layout switcher */}
        <Tabs value={activeLayout} onValueChange={runLayout} className="shrink-0">
          <TabsList className="h-8">
            <TabsTrigger value="cose-bilkent" className="text-xs px-2">Force</TabsTrigger>
            <TabsTrigger value="cola" className="text-xs px-2">Cola</TabsTrigger>
            <TabsTrigger value="concentric" className="text-xs px-2">Concentric</TabsTrigger>
            <TabsTrigger value="breadthfirst" className="text-xs px-2">Hierarchy</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filter toggle */}
        <Button variant="outline" size="sm" onClick={() => setShowFilters((p) => !p)} className="text-xs gap-1">
          <IconFilter className="w-3.5 h-3.5" />
          Filter
        </Button>

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} title="Zoom in">
            <IconZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} title="Zoom out">
            <IconZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fitAll} title="Fit all">
            <IconFocus2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exportPng} title="Export PNG">
            <IconDownload className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Category Filters ── */}
      {showFilters && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className={`${glassCard} p-3`}>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(CATEGORY_COLORS) as [OntologyCategory, (typeof CATEGORY_COLORS)[OntologyCategory]][]).map(
              ([key, val]) => (
                <button
                  key={key}
                  onClick={() => toggleCategory(key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                    activeCategories.has(key)
                      ? 'text-white border-transparent shadow-sm'
                      : 'text-gray-400 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-60'
                  }`}
                  style={activeCategories.has(key) ? { backgroundColor: val.bg, borderColor: val.border } : undefined}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: val.bg }} />
                  {val.label}
                </button>
              ),
            )}
          </div>
        </motion.div>
      )}

      {/* ── Main Grid: Graph + Detail Panel ── */}
      <div className="flex gap-4 h-[calc(100vh-360px)] min-h-[500px]">
        {/* Graph canvas */}
        <div className={`flex-1 relative ${glassCard} overflow-hidden`}>
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-blue-600 font-medium">Initialising graph…</p>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />

          {/* Legend (always visible, bottom-left) */}
          <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-xl p-3 text-xs space-y-1.5 max-w-[180px]">
            <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Legend</p>
            {(Object.entries(CATEGORY_COLORS) as [OntologyCategory, (typeof CATEGORY_COLORS)[OntologyCategory]][]).map(
              ([key, val]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: val.bg }} />
                  <span className="text-gray-700 dark:text-gray-300">{val.label}</span>
                </div>
              ),
            )}
            <div className="border-t border-blue-200 dark:border-gray-700 pt-1.5 mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-0.5 bg-gray-400" />
                <span className="text-gray-500">is_a (hierarchy)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-5 border-b-2 border-dashed border-blue-500" />
                <span className="text-gray-500">object property</span>
              </div>
            </div>
          </div>

          {/* Stats overlay (top-right) */}
          <div className="absolute top-3 right-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-xl p-3 text-xs space-y-1">
            <p className="font-semibold text-blue-900 dark:text-blue-200">Ontology Statistics</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-600 dark:text-gray-400">
              <span>Classes</span><span className="font-mono font-bold text-blue-600">{stats.classes}</span>
              <span>Properties</span><span className="font-mono font-bold text-blue-600">{stats.relationships}</span>
              <span>Hierarchy</span><span className="font-mono font-bold text-blue-600">{stats.hierarchyEdges}</span>
              <span>Domains</span><span className="font-mono font-bold text-blue-600">{stats.categories}</span>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <motion.div
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`w-80 shrink-0 ${glassCard} p-4 overflow-y-auto`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[selectedNode.category].bg }}
                />
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedNode.label}</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedNode(null); if (cyRef.current) resetHighlight(cyRef.current); }}>
                <IconX className="w-4 h-4" />
              </Button>
            </div>

            <Badge variant="secondary" className="mb-3 text-xs">
              {CATEGORY_COLORS[selectedNode.category].label}
            </Badge>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
              {selectedNode.description}
            </p>

            {/* CIDOC-CRM mapping */}
            <div className="space-y-2 mb-4">
              <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1">
                <IconInfoCircle className="w-3.5 h-3.5" />
                Ontology Mapping
              </h4>
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5 text-xs font-mono text-blue-700 dark:text-blue-300 break-all">
                {selectedNode.cidocMapping}
              </div>
              {selectedNode.parent && (
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Parent class:</span>{' '}
                  <button
                    className="text-blue-600 hover:underline"
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
              )}
            </div>

            {/* Relationships */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider flex items-center gap-1">
                <IconLayoutGrid className="w-3.5 h-3.5" />
                Relationships ({selectedEdges.length})
              </h4>
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {selectedEdges.map((e) => {
                  const isOutgoing = e.source === selectedNode.id;
                  const otherNodeId = isOutgoing ? e.target : e.source;
                  const otherNode = graphData.nodes.find((n) => n.id === otherNodeId);
                  return (
                    <button
                      key={e.id}
                      className="w-full flex items-center gap-1.5 text-xs text-left px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors group"
                      onClick={() => {
                        if (otherNode) {
                          setSelectedNode(otherNode);
                          if (cyRef.current) highlightNeighbors(cyRef.current, otherNode.id);
                        }
                      }}
                    >
                      <IconChevronRight
                        className={`w-3 h-3 shrink-0 text-blue-400 transition-transform ${
                          isOutgoing ? '' : 'rotate-180'
                        }`}
                      />
                      <span className="text-blue-600 dark:text-blue-400 font-mono truncate flex-1">
                        {e.label}
                      </span>
                      <span className="text-gray-500 truncate max-w-[100px]">{otherNode?.label ?? otherNodeId}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Property labels */}
            {selectedEdges.filter((e) => e.edgeType === 'object_property').length > 0 && (
              <div className="mt-4 space-y-1.5">
                <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                  Object Properties
                </h4>
                <div className="flex flex-wrap gap-1">
                  {[...new Set(selectedEdges.filter((e) => e.edgeType === 'object_property').map((e) => e.label))].map((p) => (
                    <span key={p} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-mono text-blue-600 dark:text-blue-400">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ── Footer note ── */}
      <div className={`${glassCard} p-3 text-center text-xs text-gray-500 dark:text-gray-400`}>
        <p>
          Ontology namespace:{' '}
          <code className="px-1 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400">
            https://w3id.org/heritagegraph/
          </code>
          {' · '}Visualisation built with Cytoscape.js{' · '}
          Schema defined in{' '}
          <a
            href="https://linkml.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            LinkML
          </a>
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
 *  Helper functions (outside component)
 * ═══════════════════════════════════════════════════════ */

function buildElements(data: ReturnType<typeof getOntologyGraphData>) {
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
    data: {
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      edgeType: e.edgeType,
    },
  }));

  return [...nodes, ...edges];
}

function buildStyles(): any[] {
  return [
    /* ── Nodes ── */
    {
      selector: 'node',
      style: {
        'background-color': 'data(color)',
        'border-color': 'data(borderColor)',
        'border-width': 2,
        label: 'data(label)',
        color: '#1e3a5f',
        'font-size': '10px',
        'font-weight': 600,
        'text-valign': 'bottom',
        'text-halign': 'center',
        'text-margin-y': 6,
        'text-wrap': 'ellipsis',
        'text-max-width': '100px',
        width: 32,
        height: 32,
        shape: 'ellipse',
        'overlay-padding': 4,
        'transition-property': 'background-color, border-color, width, height, opacity',
        'transition-duration': '0.25s',
      },
    },
    /* ── is_a edges (solid, gray) ── */
    {
      selector: 'edge[edgeType="is_a"]',
      style: {
        'curve-style': 'bezier',
        'target-arrow-shape': 'triangle',
        'arrow-scale': 0.8,
        'line-color': '#94a3b8',
        'target-arrow-color': '#94a3b8',
        width: 1.5,
        'line-style': 'solid',
        opacity: 0.7,
        'transition-property': 'opacity, line-color',
        'transition-duration': '0.25s',
      },
    },
    /* ── object_property edges (dashed, blue) ── */
    {
      selector: 'edge[edgeType="object_property"]',
      style: {
        'curve-style': 'bezier',
        'target-arrow-shape': 'vee',
        'arrow-scale': 0.7,
        'line-color': '#3b82f6',
        'target-arrow-color': '#3b82f6',
        width: 1,
        'line-style': 'dashed',
        'line-dash-pattern': [6, 3],
        opacity: 0.4,
        label: 'data(label)',
        'font-size': '7px',
        color: '#64748b',
        'text-rotation': 'autorotate',
        'text-margin-y': -8,
        'transition-property': 'opacity, line-color',
        'transition-duration': '0.25s',
      },
    },
    /* ── Highlighted state ── */
    {
      selector: '.highlighted',
      style: { opacity: 1 },
    },
    {
      selector: 'node.highlighted',
      style: {
        width: 42,
        height: 42,
        'border-width': 3,
        'font-size': '12px',
        'font-weight': 700,
      },
    },
    /* ── Faded state ── */
    {
      selector: '.faded',
      style: { opacity: 0.12 },
    },
    /* ── Searched state ── */
    {
      selector: 'node.searched',
      style: {
        width: 46,
        height: 46,
        'border-width': 4,
        'border-color': '#f59e0b',
        'font-size': '13px',
        'font-weight': 700,
        opacity: 1,
      },
    },
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
  cy.batch(() => {
    cy.elements().removeClass('highlighted faded searched');
  });
}
