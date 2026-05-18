'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { NODE_TYPE_CONFIG, RELATION_LABELS, type GraphNode, type GraphLink, type GraphData } from '../heritage-data';

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

export function ForceGraph({
  data, selectedId, onNodeSelect, highlightedIds,
  pathHighlight, pathPickMode, pathSource,
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

  const handleClick = useCallback((node: GraphNode) => onNodeSelect(node), [onNodeSelect]);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = svgRef.current.getBoundingClientRect();
    const cx = width / 2;
    const cy = height / 2;

    svg.selectAll('*').remove();

    // ── Defs ───────────────────────────────────────────────
    const defs = svg.append('defs');

    Object.entries(NODE_TYPE_CONFIG).forEach(([type, cfg]) => {
      const filter = defs
        .append('filter')
        .attr('id', `hm-glow-${type}`)
        .attr('x', '-50%').attr('y', '-50%')
        .attr('width', '200%').attr('height', '200%');
      filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
      const merge = filter.append('feMerge');
      merge.append('feMergeNode').attr('in', 'coloredBlur');
      merge.append('feMergeNode').attr('in', 'SourceGraphic');

      const grad = defs
        .append('radialGradient')
        .attr('id', `hm-grad-${type}`)
        .attr('cx', '35%').attr('cy', '35%');
      grad.append('stop').attr('offset', '0%').attr('stop-color', cfg.glowColor);
      grad.append('stop').attr('offset', '100%').attr('stop-color', cfg.color);
    });

    defs.append('marker')
      .attr('id', 'hm-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', NODE_RADIUS + 10).attr('refY', 0)
      .attr('markerWidth', 6).attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', '#4b5563');

    // ── Zoomable container ─────────────────────────────────
    const container = svg.append('g').attr('class', 'hm-zoom-container');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', (e) => container.attr('transform', e.transform));
    svg.call(zoom);

    // ── Clone data ─────────────────────────────────────────
    const nodes: GraphNode[] = data.nodes.map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 300,
      y: cy + (Math.random() - 0.5) * 300,
    }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const links: GraphLink[] = data.links
      .map((l) => ({
        ...l,
        source: nodeById.get(l.source as string) || (l.source as GraphNode),
        target: nodeById.get(l.target as string) || (l.target as GraphNode),
      }))
      .filter((l) => typeof l.source !== 'string' && typeof l.target !== 'string');

    // ── Simulation ─────────────────────────────────────────
    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force('link',
        d3.forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id).distance(LINK_DISTANCE).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(cx, cy).strength(0.05))
      .force('collision', d3.forceCollide(NODE_RADIUS + 12))
      .force('x', d3.forceX(cx).strength(0.02))
      .force('y', d3.forceY(cy).strength(0.02));

    simulationRef.current = simulation;

    // ── Links ──────────────────────────────────────────────
    const linkGroup = container.append('g').attr('class', 'hm-links');
    const linkEl = linkGroup
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links).enter().append('line')
      .attr('stroke', '#374151').attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6).attr('marker-end', 'url(#hm-arrow)');

    const linkLabelEl = linkGroup
      .selectAll<SVGTextElement, GraphLink>('text')
      .data(links).enter().append('text')
      .attr('font-size', 9).attr('fill', '#6b7280')
      .attr('text-anchor', 'middle').attr('dy', -4)
      .text((d) => RELATION_LABELS[d.predicate] || d.predicate);

    // ── Nodes ──────────────────────────────────────────────
    const nodeGroup = container.append('g').attr('class', 'hm-nodes');
    const nodeEl = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes).enter().append('g')
      .attr('class', 'hm-node-group')
      .style('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end',   (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }),
      )
      .on('click', (_, d) => handleClick(d));

    // Selection ring
    nodeEl.append('circle')
      .attr('r', NODE_RADIUS + 8).attr('fill', 'none')
      .attr('stroke', (d) => NODE_TYPE_CONFIG[d.nodeType]?.glowColor ?? '#fff')
      .attr('stroke-width', 2).attr('stroke-dasharray', '4 3')
      .attr('opacity', (d) => (d.id === selectedId ? 1 : 0))
      .attr('class', 'hm-selection-ring');

    // Main circle
    nodeEl.append('circle')
      .attr('r', NODE_RADIUS)
      .attr('fill', (d) => `url(#hm-grad-${d.nodeType})`)
      .attr('filter', (d) => `url(#hm-glow-${d.nodeType})`)
      .attr('stroke', (d) => NODE_TYPE_CONFIG[d.nodeType]?.glowColor ?? '#fff')
      .attr('stroke-width', 1.5);

    // Emoji
    nodeEl.append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', 16).attr('y', -4)
      .text((d) => NODE_TYPE_CONFIG[d.nodeType]?.emoji ?? '●');

    // Label
    nodeEl.append('text')
      .attr('text-anchor', 'middle').attr('y', NODE_RADIUS + 16)
      .attr('font-size', 11).attr('font-weight', '500').attr('fill', '#e5e7eb')
      .attr('paint-order', 'stroke').attr('stroke', '#111827').attr('stroke-width', 3)
      .text((d) => (d.label.length > 18 ? d.label.slice(0, 16) + '…' : d.label));

    // UNESCO badge
    nodeEl.filter((d) => !!d.unescoStatus)
      .append('circle')
      .attr('cx', NODE_RADIUS - 4).attr('cy', -(NODE_RADIUS - 4))
      .attr('r', 6).attr('fill', '#1d4ed8').attr('stroke', '#93c5fd').attr('stroke-width', 1);
    nodeEl.filter((d) => !!d.unescoStatus)
      .append('text')
      .attr('x', NODE_RADIUS - 4).attr('y', -(NODE_RADIUS - 4))
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', 7).attr('fill', '#fff').text('U');

    // ── Tick ───────────────────────────────────────────────
    simulation.on('tick', () => {
      linkEl
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0);
      linkLabelEl
        .attr('x', (d) => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
        .attr('y', (d) => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2);
      nodeEl.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    svg.style('opacity', 0).transition().duration(800).style('opacity', 1);

    return () => { simulation.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Update selection ring without re-simulation
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current)
      .selectAll<SVGCircleElement, GraphNode>('.hm-selection-ring')
      .attr('opacity', (d) => (d.id === selectedId ? 1 : 0));
  }, [selectedId]);

  // Dim non-highlighted nodes (neighbour highlight)
  useEffect(() => {
    if (!svgRef.current) return;
    // Path highlight takes precedence
    if (pathHighlight && pathHighlight.nodeIds.size > 0) return;
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
      // Clear path styling
      svg.selectAll<SVGGElement, GraphNode>('.hm-node-group').attr('opacity', 1);
      svg.selectAll<SVGLineElement, GraphLink>('.hm-path-edge').attr('stroke', '#374151').attr('stroke-width', 1.5).attr('stroke-opacity', 0.6).classed('hm-path-edge', false);
      svg.selectAll('.hm-path-ring').remove();
      return;
    }

    const { nodeIds, edgePairs } = pathHighlight;

    // Dim / brighten nodes
    svg.selectAll<SVGGElement, GraphNode>('.hm-node-group')
      .attr('opacity', (d) => (nodeIds.has(d.id) ? 1 : 0.12));

    // Gold ring on path nodes
    svg.selectAll('.hm-path-ring').remove();
    svg.selectAll<SVGGElement, GraphNode>('.hm-node-group')
      .filter((d) => nodeIds.has(d.id))
      .append('circle')
      .attr('class', 'hm-path-ring')
      .attr('r', NODE_RADIUS + 11)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '5 3')
      .style('animation', 'hm-spin 4s linear infinite');

    // Colour path links gold
    svg.selectAll<SVGLineElement, GraphLink>('line')
      .each(function (d) {
        const s = typeof d.source === 'string' ? d.source : (d.source as GraphNode).id;
        const t = typeof d.target === 'string' ? d.target : (d.target as GraphNode).id;
        const key1 = `${s}→${t}`;
        const key2 = `${t}→${s}`;
        if (edgePairs.has(key1) || edgePairs.has(key2)) {
          d3.select(this).attr('stroke', '#f59e0b').attr('stroke-width', 3).attr('stroke-opacity', 1).classed('hm-path-edge', true);
        } else {
          d3.select(this).attr('stroke', '#374151').attr('stroke-width', 1.5).attr('stroke-opacity', 0.15);
        }
      });
  }, [pathHighlight]);

  // Path-pick mode: crosshair cursor + pulse on source node
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).style('cursor', pathPickMode ? 'crosshair' : 'default');
    // Pulse ring on the first picked node
    d3.select(svgRef.current)
      .selectAll<SVGGElement, GraphNode>('.hm-node-group')
      .select('.hm-selection-ring')
      .attr('stroke', (d) =>
        pathPickMode && pathSource && d.id === pathSource
          ? '#f59e0b'
          : (NODE_TYPE_CONFIG[d.nodeType]?.glowColor ?? '#fff'),
      )
      .attr('stroke-width', (d) => (pathPickMode && pathSource && d.id === pathSource ? 3 : 2));
  }, [pathPickMode, pathSource]);

  return <svg ref={svgRef} className="w-full h-full" style={{ background: 'transparent' }} />;
}
