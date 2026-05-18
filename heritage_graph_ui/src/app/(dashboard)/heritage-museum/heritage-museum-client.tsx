'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  fetchHeritageDemoData,
  NODE_TYPE_CONFIG,
  type NodeType,
  type GraphNode,
  type GraphData,
} from './heritage-data';
import { FilterBar } from './components/FilterBar';
import { StoryPanel } from './components/StoryPanel';
import { MandalaLoader } from './components/MandalaLoader';
import { TimelineStrip } from './components/TimelineStrip';

type ViewMode = '2d' | 'xr';

const ForceGraph = dynamic(
  () => import('./components/ForceGraph').then((m) => m.ForceGraph),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <MandalaLoader />
      </div>
    ),
  },
);

const ImmersiveScene = dynamic(
  () => import('./components/xr/ImmersiveScene').then((m) => m.ImmersiveScene),
  { ssr: false },
);

const PlaceNav = dynamic(
  () => import('./components/xr/PlaceNav').then((m) => m.PlaceNav),
  { ssr: false },
);

const ALL_TYPES = new Set(Object.keys(NODE_TYPE_CONFIG) as NodeType[]);
const EMPTY: GraphData = { nodes: [], links: [] };

function ViewBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={
        active
          ? { background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.4)' }
          : { background: 'rgba(255,255,255,0.05)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)' }
      }
    >
      {children}
    </button>
  );
}

export function HeritageMindMapClient() {
  const [fullGraph, setFullGraph] = useState<GraphData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeTypes, setActiveTypes]   = useState<Set<NodeType>>(ALL_TYPES);
  const [searchQuery, setSearchQuery]   = useState('');
  const [panelOpen, setPanelOpen]       = useState(false);
  const [viewMode, setViewMode]         = useState<ViewMode>('2d');

  useEffect(() => {
    fetchHeritageDemoData()
      .then((d) => { setFullGraph(d); setLoading(false); })
      .catch(() => { setError('Could not load heritage data.'); setLoading(false); });
  }, []);

  const filteredGraph = useMemo<GraphData | null>(() => {
    if (!fullGraph) return null;
    const q = searchQuery.toLowerCase();
    const visible = fullGraph.nodes.filter((n) => {
      if (!activeTypes.has(n.nodeType)) return false;
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
  }, [fullGraph, activeTypes, searchQuery]);

  const highlightedIds = useMemo<Set<string>>(() => {
    if (!selectedNode || !filteredGraph) return new Set();
    const ids = new Set<string>([selectedNode.id]);
    for (const l of filteredGraph.links) {
      if (l.source === selectedNode.id) ids.add(l.target as string);
      if (l.target === selectedNode.id) ids.add(l.source as string);
    }
    return ids;
  }, [selectedNode, filteredGraph]);

  const handleNodeSelect = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    setPanelOpen(true);
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

  const switchToXR = useCallback((node?: GraphNode) => {
    if (node) setSelectedNode(node);
    setViewMode('xr');
  }, []);

  const nodeCount = filteredGraph?.nodes.length ?? 0;
  const linkCount = filteredGraph?.links.length ?? 0;

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-white/10 bg-gray-950/95 backdrop-blur-md z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-base shadow-lg shadow-amber-500/30">
            🏔
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight">Nepal Heritage Knowledge Graph</h1>
            <p className="text-gray-500 text-xs">
              Immersive Story Museum · Ontology:{' '}
              <span className="text-amber-500/80">CIDOC-CRM</span>
              {' · '}
              <span className="text-amber-500/80">hg:</span>
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {!loading && (
          <span className="hidden sm:block text-xs text-gray-600">
            {nodeCount} nodes · {linkCount} relations
          </span>
        )}

        {/* View mode toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
          <ViewBtn active={viewMode === '2d'} onClick={() => setViewMode('2d')}>
            ⬡ Graph
          </ViewBtn>
          <ViewBtn active={viewMode === 'xr'} onClick={() => switchToXR()}>
            ◈ Immersive XR
          </ViewBtn>
        </div>

        <div className="hidden lg:flex items-center gap-1.5">
          {(['CIDOC-CRM', 'hg:', 'PROV-O', 'JSON-LD'] as const).map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-green-500/30 bg-green-900/20 text-green-400 font-mono">
              {t}
            </span>
          ))}
        </div>
      </header>

      {/* ── 2D Mode ── */}
      {viewMode === '2d' && (
        <>
          {/* Filter bar */}
          <div className="flex-shrink-0 z-10">
            <FilterBar
              activeTypes={activeTypes}
              onToggle={toggleType}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Main area */}
          <div className="flex flex-1 min-h-0">

            {/* Graph canvas */}
            <div className="relative flex-1 min-w-0 min-h-0">
              {/* Decorative ambient blobs */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-amber-500/[0.04] blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-indigo-500/[0.04] blur-3xl" />
              </div>

              {/* Loading / error state */}
              {loading && (
                <div className="absolute inset-0">
                  <MandalaLoader />
                </div>
              )}
              {!loading && error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center space-y-3 p-8">
                    <p className="text-4xl">⚠️</p>
                    <p className="text-gray-400 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Force graph */}
              {!loading && !error && (
                <div className="absolute inset-0">
                  <ForceGraph
                    data={filteredGraph ?? EMPTY}
                    selectedId={selectedNode?.id ?? null}
                    onNodeSelect={handleNodeSelect}
                    highlightedIds={highlightedIds}
                  />
                </div>
              )}

              {/* Hint tooltip */}
              {!loading && !error && !selectedNode && nodeCount > 0 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="text-xs text-gray-500 bg-gray-900/80 backdrop-blur-sm rounded-full px-4 py-2 border border-white/10 flex items-center gap-2">
                    <span className="animate-bounce inline-block">👆</span>
                    Click a node · Drag · Scroll to zoom ·{' '}
                    <button
                      className="pointer-events-auto text-amber-400 hover:text-amber-300 underline underline-offset-2"
                      onClick={() => switchToXR()}
                    >
                      Switch to Immersive XR
                    </button>
                  </div>
                </div>
              )}

              {/* View in XR button when node selected */}
              {!loading && !error && selectedNode && (
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => switchToXR(selectedNode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                  >
                    ◈ View in XR
                  </button>
                </div>
              )}
            </div>

            {/* Desktop story sidebar */}
            <div className="hidden lg:flex flex-col w-96 min-h-0 border-l border-white/10 bg-gray-900/60 backdrop-blur-md overflow-hidden">
              <StoryPanel
                node={selectedNode}
                graphData={filteredGraph ?? EMPTY}
                onRelatedNodeClick={handleRelatedNodeClick}
              />
            </div>
          </div>

          {/* Timeline strip */}
          {!loading && !error && (
            <TimelineStrip
              nodes={filteredGraph?.nodes ?? []}
              selectedId={selectedNode?.id ?? null}
              onSelect={handleNodeSelect}
            />
          )}
        </>
      )}

      {/* ── XR Mode ── */}
      {viewMode === 'xr' && (
        <div className="flex flex-1 min-h-0">
          {/* Place navigation sidebar */}
          <div className="w-52 flex-shrink-0">
            <PlaceNav
              nodes={filteredGraph?.nodes ?? []}
              selectedId={selectedNode?.id ?? null}
              onSelect={handleNodeSelect}
            />
          </div>

          {/* Immersive scene */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <MandalaLoader />
            ) : (
              <ImmersiveScene
                node={selectedNode}
                allNodes={filteredGraph?.nodes ?? []}
                onSelect={handleNodeSelect}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile story drawer (2D mode only) */}
      {viewMode === '2d' && panelOpen && selectedNode && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="flex-1 bg-black/60 backdrop-blur-sm"
            onClick={() => setPanelOpen(false)}
          />
          <div className="bg-gray-900 border-t border-white/10 h-3/4 rounded-t-2xl overflow-hidden flex flex-col relative">
            <div className="flex items-center justify-center px-5 py-3 border-b border-white/10 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
              <button
                onClick={() => setPanelOpen(false)}
                className="absolute right-5 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <StoryPanel
                node={selectedNode}
                graphData={filteredGraph ?? EMPTY}
                onRelatedNodeClick={handleRelatedNodeClick}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
