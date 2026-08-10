'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import {
  NODE_TYPE_CONFIG,
  RELATION_LABELS,
  type GraphNode,
  type GraphLink,
  type GraphData,
} from '../heritage-data';
import { nodeIconInner } from '../node-icons';

interface ForceGraphProps {
  data: GraphData;
  selectedId: string | null;
  onNodeSelect: (node: GraphNode) => void;
  highlightedIds?: Set<string>;
  pathHighlight?: { nodeIds: Set<string>; edgePairs: Set<string> };
  pathPickMode?: boolean;
  pathSource?: string | null;
}

const NODE_RADIUS = 28;
const LINK_DISTANCE = 160;

// Adaptive charge: -300 for tiny graphs, scaling down to -800 for larger
// graphs. Empirically this keeps nodes apart without flinging them off-canvas.
function chargeStrength(n: number): number {
  return Math.max(-800, -300 - n * 2);
}

// Truncate to roughly 2 * radius / 7px (≈ avg sans-serif char width at 11px).
const MAX_LABEL_CHARS = Math.floor((NODE_RADIUS * 2) / 6); // ≈ 9; we render bigger though
const LABEL_BUDGET = 28; // generous; many Nepali heritage names are 20+ chars
function truncate(s: string, max = LABEL_BUDGET): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

// One stable signature per data snapshot. Used to decide when to do a *full*
// rebuild vs an incremental update.
function dataSignature(d: GraphData): string {
  const ns = d.nodes
    .map((n) => n.id)
    .sort()
    .join(',');
  const ls = d.links
    .map((l) => {
      const s = typeof l.source === 'string' ? l.source : l.source.id;
      const t = typeof l.target === 'string' ? l.target : l.target.id;
      return `${s}>${t}>${l.predicate}`;
    })
    .sort()
    .join(',');
  return `${ns}|${ls}`;
}

type AnnotatedLink = GraphLink & { _idx: number; _total: number };

// Compute edge index for parallel-edge offsets so multiple predicates between
// the same node pair fan out as curves instead of overlapping straight lines.
function annotateParallels(links: GraphLink[]): AnnotatedLink[] {
  const groups = new Map<string, GraphLink[]>();
  for (const l of links) {
    const s = typeof l.source === 'string' ? l.source : l.source.id;
    const t = typeof l.target === 'string' ? l.target : l.target.id;
    const key = s < t ? `${s}|${t}` : `${t}|${s}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }
  const out: AnnotatedLink[] = [];
  for (const [, group] of groups) {
    group.forEach((l, i) => out.push({ ...l, _idx: i, _total: group.length }));
  }
  return out;
}

export function ForceGraph({
  data,
  selectedId,
  onNodeSelect,
  highlightedIds,
  pathHighlight,
  pathPickMode,
  pathSource,
}: ForceGraphProps) {
  const t = useTranslations('heritageMuseum');
  const graphAriaLabel = t('graphAriaLabel');
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  // Persistent node-position cache so filter toggles don't reset layout.
  const nodePosCacheRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Last applied data signature — drives incremental update vs full rebuild.
  const lastSignatureRef = useRef<string>('');
  // Live node array used by the simulation (mutated by D3 in place).
  const simNodesRef = useRef<GraphNode[]>([]);
  const simLinksRef = useRef<AnnotatedLink[]>([]);

  const handleClick = useCallback((node: GraphNode) => onNodeSelect(node), [onNodeSelect]);

  // Hoist annotated links so the tick handler can use parallel-curve offsets.
  const annotatedLinks = useMemo(() => annotateParallels(data.links), [data.links]);

  // ── Initial setup (defs, zoom, container) — runs once per mount ──
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');

    // Per-node-type filters + gradients
    Object.entries(NODE_TYPE_CONFIG).forEach(([type, cfg]) => {
      const filter = defs
        .append('filter')
        .attr('id', `hm-glow-${type}`)
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%');
      filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
      const merge = filter.append('feMerge');
      merge.append('feMergeNode').attr('in', 'coloredBlur');
      merge.append('feMergeNode').attr('in', 'SourceGraphic');

      const grad = defs
        .append('radialGradient')
        .attr('id', `hm-grad-${type}`)
        .attr('cx', '35%')
        .attr('cy', '35%');
      grad.append('stop').attr('offset', '0%').attr('stop-color', cfg.glowColor);
      grad.append('stop').attr('offset', '100%').attr('stop-color', cfg.color);
    });

    // Arrow marker
    defs
      .append('marker')
      .attr('id', 'hm-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', NODE_RADIUS + 6)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#4b5563');

    // Zoom container + zoom behavior
    const container = svg.append('g').attr('class', 'hm-zoom-container');
    container.append('g').attr('class', 'hm-links');
    container.append('g').attr('class', 'hm-link-labels');
    container.append('g').attr('class', 'hm-nodes');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', (e) => {
        container.attr('transform', e.transform);
        // Hide link labels when zoomed out to reduce clutter
        container
          .select('.hm-link-labels')
          .attr('opacity', e.transform.k > 0.55 ? 1 : 0);
      });
    svg.call(zoom);

    // Accessibility metadata
    svg.attr('role', 'img').attr('aria-label', graphAriaLabel);

    return () => {
      simulationRef.current?.stop();
    };
  }, []);

  // ── Data-driven update: data-join, no full teardown ──
  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) {
      simulationRef.current?.stop();
      return;
    }

    const sig = dataSignature(data);
    const isFreshGraph = sig !== lastSignatureRef.current;
    lastSignatureRef.current = sig;

    const svg = d3.select(svgRef.current);
    const { width, height } = svgRef.current.getBoundingClientRect();
    const cx = width / 2;
    const cy = height / 2;

    // ── Reconcile node set: preserve x/y for surviving nodes ──
    const cache = nodePosCacheRef.current;
    const prevNodesById = new Map(simNodesRef.current.map((n) => [n.id, n]));

    const nextNodes: GraphNode[] = data.nodes.map((d) => {
      const cached = cache.get(d.id);
      const prev = prevNodesById.get(d.id);
      const seed = prev ?? cached;
      return {
        ...d,
        x: seed?.x ?? cx + (Math.random() - 0.5) * 200,
        y: seed?.y ?? cy + (Math.random() - 0.5) * 200,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
        fx: prev?.fx ?? null,
        fy: prev?.fy ?? null,
      } as GraphNode;
    });
    const nodeById = new Map(nextNodes.map((n) => [n.id, n]));

    // Resolve links to current node refs (drop dangling ones)
    const nextLinks: AnnotatedLink[] = annotatedLinks
      .map((l): AnnotatedLink | null => {
        const sId = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const tId = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        const s = nodeById.get(sId);
        const t = nodeById.get(tId);
        if (!s || !t) return null;
        return { ...l, source: s, target: t };
      })
      .filter((l): l is AnnotatedLink => l !== null);

    simNodesRef.current = nextNodes;
    simLinksRef.current = nextLinks;

    // ── Simulation: create once, then update nodes/links in place ──
    let sim = simulationRef.current;
    if (!sim) {
      sim = d3
        .forceSimulation<GraphNode>(nextNodes)
        .force(
          'link',
          d3
            .forceLink<GraphNode, GraphLink>(nextLinks)
            .id((d) => d.id)
            .distance(LINK_DISTANCE)
            .strength(0.4),
        )
        .force('charge', d3.forceManyBody().strength(chargeStrength(nextNodes.length)))
        .force('center', d3.forceCenter(cx, cy).strength(0.05))
        .force('collision', d3.forceCollide(NODE_RADIUS + 12))
        .force('x', d3.forceX(cx).strength(0.02))
        .force('y', d3.forceY(cy).strength(0.02));
      simulationRef.current = sim;
    } else {
      sim.nodes(nextNodes);
      const linkForce = sim.force<d3.ForceLink<GraphNode, GraphLink>>('link');
      if (linkForce) linkForce.links(nextLinks);
      sim.force('charge', d3.forceManyBody().strength(chargeStrength(nextNodes.length)));
      sim.force('center', d3.forceCenter(cx, cy).strength(0.05));
    }
    if (isFreshGraph) {
      sim.alpha(0.7).restart();
    } else {
      sim.alpha(0.2).restart();
    }

    // ── Data-join: links ──
    const linksG = svg.select<SVGGElement>('.hm-links');
    const linkSel = linksG
      .selectAll<SVGPathElement, GraphLink>('path')
      .data(nextLinks, (d) => {
        const s = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
        const t = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
        return `${s}>${t}>${d.predicate}`;
      });
    linkSel.exit().remove();
    const linkEnter = linkSel
      .enter()
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', '#374151')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#hm-arrow)');
    const linkMerged = linkEnter.merge(linkSel);

    // ── Data-join: link labels ──
    const labelsG = svg.select<SVGGElement>('.hm-link-labels');
    const labelSel = labelsG
      .selectAll<SVGTextElement, GraphLink>('text')
      .data(nextLinks, (d) => {
        const s = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
        const t = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
        return `${s}>${t}>${d.predicate}`;
      });
    labelSel.exit().remove();
    const labelEnter = labelSel
      .enter()
      .append('text')
      .attr('font-size', 9)
      .attr('fill', '#6b7280')
      .attr('text-anchor', 'middle')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#0b0f1a')
      .attr('stroke-width', 2.5);
    const labelMerged = labelEnter.merge(labelSel);
    labelMerged.text((d) => RELATION_LABELS[d.predicate] || d.predicate.replace(/_/g, ' '));

    // ── Data-join: node groups ──
    const nodesG = svg.select<SVGGElement>('.hm-nodes');
    const nodeSel = nodesG
      .selectAll<SVGGElement, GraphNode>('g.hm-node-group')
      .data(nextNodes, (d) => d.id);

    nodeSel.exit().remove();

    const nodeEnter = nodeSel
      .enter()
      .append('g')
      .attr('class', 'hm-node-group')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.label}, ${NODE_TYPE_CONFIG[d.nodeType]?.label ?? d.nodeType}`)
      .style('cursor', 'pointer');

    // Drag behaviour bound on enter
    nodeEnter.call(
      d3
        .drag<SVGGElement, GraphNode>()
        .on('start', (e, d) => {
          if (!e.active) sim!.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (e, d) => {
          d.fx = e.x;
          d.fy = e.y;
        })
        .on('end', (e, d) => {
          if (!e.active) sim!.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

    nodeEnter.on('click', (_, d) => handleClick(d));
    nodeEnter.on('keydown', function (event, d) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick(d);
      }
    });

    // Selection ring
    nodeEnter
      .append('circle')
      .attr('class', 'hm-selection-ring')
      .attr('r', NODE_RADIUS + 8)
      .attr('fill', 'none')
      .attr('stroke', (d) => NODE_TYPE_CONFIG[d.nodeType]?.glowColor ?? '#fff')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 3')
      .attr('opacity', 0);

    // Main circle
    nodeEnter
      .append('circle')
      .attr('class', 'hm-main-circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', (d) => `url(#hm-grad-${d.nodeType})`)
      .attr('filter', (d) => `url(#hm-glow-${d.nodeType})`)
      .attr('stroke', (d) => NODE_TYPE_CONFIG[d.nodeType]?.glowColor ?? '#fff')
      .attr('stroke-width', 1.5);

    // Node glyph — deterministic Tabler SVG (24×24) scaled to ~20px, white for
    // contrast on the coloured disc. innerHTML on an SVG <g> parses in the SVG
    // namespace in all evergreen browsers.
    const GLYPH_PX = 20;
    const glyphScale = GLYPH_PX / 24;
    nodeEnter
      .append('g')
      .attr('class', 'hm-glyph')
      .attr('transform', `translate(${-GLYPH_PX / 2}, ${-4 - GLYPH_PX / 2}) scale(${glyphScale})`)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .style('pointer-events', 'none')
      .each(function (d) {
        this.innerHTML = nodeIconInner(d.nodeType);
      });

    // Title accessibility (hover/screen-reader)
    nodeEnter
      .append('title')
      .text((d) => `${d.label}\n${NODE_TYPE_CONFIG[d.nodeType]?.cidocMapping ?? ''}`);

    // Label
    nodeEnter
      .append('text')
      .attr('class', 'hm-label')
      .attr('text-anchor', 'middle')
      .attr('y', NODE_RADIUS + 16)
      .attr('font-size', 11)
      .attr('font-weight', '500')
      .attr('fill', '#e5e7eb')
      .attr('paint-order', 'stroke')
      .attr('stroke', '#111827')
      .attr('stroke-width', 3);

    // UNESCO badge (on enter only — text might still be updated below)
    nodeEnter
      .filter((d) => !!d.unescoStatus)
      .append('g')
      .attr('class', 'hm-unesco')
      .each(function (d) {
        const g = d3.select(this);
        g.append('circle')
          .attr('cx', NODE_RADIUS - 4)
          .attr('cy', -(NODE_RADIUS - 4))
          .attr('r', 6)
          .attr('fill', '#1d4ed8')
          .attr('stroke', '#93c5fd')
          .attr('stroke-width', 1);
        g.append('text')
          .attr('x', NODE_RADIUS - 4)
          .attr('y', -(NODE_RADIUS - 4))
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', 7)
          .attr('fill', '#fff')
          .text('U');
        // silence unused-var lint
        void d;
      });

    const nodeMerged = nodeEnter.merge(nodeSel);
    nodeMerged.select('.hm-label').text((d) => truncate(d.label));

    // ── Tick: position links (with parallel-curve fan-out) and nodes ──
    sim.on('tick', () => {
      linkMerged.attr('d', (l) => {
        const s = l.source as GraphNode;
        const t = l.target as GraphNode;
        const sx = s.x ?? 0;
        const sy = s.y ?? 0;
        const tx = t.x ?? 0;
        const ty = t.y ?? 0;
        const meta = l as GraphLink & { _idx?: number; _total?: number };
        const total = meta._total ?? 1;
        const idx = meta._idx ?? 0;
        if (total <= 1) {
          return `M${sx},${sy}L${tx},${ty}`;
        }
        // Spread parallel edges around the midpoint perpendicular axis
        const dx = tx - sx;
        const dy = ty - sy;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const offset = (idx - (total - 1) / 2) * 18;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ox = (-dy / len) * offset;
        const oy = (dx / len) * offset;
        return `M${sx},${sy}Q${mx + ox},${my + oy} ${tx},${ty}`;
      });

      labelMerged.attr('x', (l) => {
        const s = l.source as GraphNode;
        const t = l.target as GraphNode;
        return ((s.x ?? 0) + (t.x ?? 0)) / 2;
      }).attr('y', (l) => {
        const s = l.source as GraphNode;
        const t = l.target as GraphNode;
        return ((s.y ?? 0) + (t.y ?? 0)) / 2 - 4;
      });

      nodeMerged.attr('transform', (d) => {
        // Cache position for next layout cycle
        if (typeof d.x === 'number' && typeof d.y === 'number') {
          nodePosCacheRef.current.set(d.id, { x: d.x, y: d.y });
        }
        return `translate(${d.x ?? 0},${d.y ?? 0})`;
      });
    });

    // Cleanup happens via the simulation reference on unmount.
  }, [data, annotatedLinks, handleClick]);

  // Update selection ring opacity without re-simulation
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, GraphNode>('.hm-selection-ring')
      .attr('opacity', (d) => (d.id === selectedId ? 1 : 0));
  }, [selectedId]);

  // Dim non-highlighted nodes (neighbour highlight)
  useEffect(() => {
    if (!svgRef.current) return;
    if (pathHighlight && pathHighlight.nodeIds.size > 0) return; // path takes precedence
    d3.select(svgRef.current)
      .selectAll<SVGGElement, GraphNode>('.hm-node-group')
      .attr('opacity', (d) =>
        !highlightedIds || highlightedIds.size === 0 || highlightedIds.has(d.id) ? 1 : 0.25,
      );
  }, [highlightedIds, pathHighlight]);

  // Path highlight: gold rings on path nodes, dim everything else
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    if (!pathHighlight || pathHighlight.nodeIds.size === 0) {
      svg.selectAll<SVGGElement, GraphNode>('.hm-node-group').attr('opacity', 1);
      svg
        .selectAll<SVGPathElement, GraphLink>('path.hm-path-edge')
        .attr('stroke', '#374151')
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.6)
        .classed('hm-path-edge', false);
      svg.selectAll('.hm-path-ring').remove();
      return;
    }

    const { nodeIds, edgePairs } = pathHighlight;

    svg
      .selectAll<SVGGElement, GraphNode>('.hm-node-group')
      .attr('opacity', (d) => (nodeIds.has(d.id) ? 1 : 0.12));

    svg.selectAll('.hm-path-ring').remove();
    svg
      .selectAll<SVGGElement, GraphNode>('.hm-node-group')
      .filter((d) => nodeIds.has(d.id))
      .append('circle')
      .attr('class', 'hm-path-ring')
      .attr('r', NODE_RADIUS + 11)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '5 3');

    svg.selectAll<SVGPathElement, GraphLink>('path').each(function (d) {
      const s = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
      const t = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
      const key1 = `${s}→${t}`;
      const key2 = `${t}→${s}`;
      if (edgePairs.has(key1) || edgePairs.has(key2)) {
        d3.select(this)
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 1)
          .classed('hm-path-edge', true);
      } else {
        d3.select(this).attr('stroke', '#374151').attr('stroke-width', 1.5).attr('stroke-opacity', 0.15);
      }
    });
  }, [pathHighlight]);

  // Path-pick mode: crosshair cursor + pulse on source node
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).style('cursor', pathPickMode ? 'crosshair' : 'default');
    d3.select(svgRef.current)
      .selectAll<SVGGElement, GraphNode>('.hm-node-group')
      .select('.hm-selection-ring')
      .attr('stroke', (d) =>
        pathPickMode && pathSource && d.id === pathSource
          ? '#f59e0b'
          : NODE_TYPE_CONFIG[d.nodeType]?.glowColor ?? '#fff',
      )
      .attr('stroke-width', (d) => (pathPickMode && pathSource && d.id === pathSource ? 3 : 2));
  }, [pathPickMode, pathSource]);

  // ── Render ──
  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ background: 'transparent' }}
      aria-busy={data.nodes.length === 0}
    />
  );
}
