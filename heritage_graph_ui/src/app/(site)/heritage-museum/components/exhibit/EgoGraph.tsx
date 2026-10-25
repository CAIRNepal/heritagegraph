'use client';

import { useTranslations } from 'next-intl';

import { NODE_TYPE_CONFIG, type GraphData, type GraphNode } from '../../heritage-data';
import { connectionsOf, useExhibitWords } from './exhibit-utils';

const W = 900;
const H = 560;

export interface EgoGraphProps {
  node: GraphNode;
  graph: GraphData;
  onSelect: (node: GraphNode) => void;
}

/**
 * The selected record at the centre, its direct connections on a ring with
 * the relation written on each line, and up to three of each neighbour's own
 * connections beyond. A whole-corpus force layout drew every edge label at
 * once and could not be read; this draws only what the reader is looking at.
 */
export function EgoGraph({ node, graph, onSelect }: EgoGraphProps) {
  const tx = useTranslations('heritageMuseum.exhibit');
  const words = useExhibitWords();
  const cx = W / 2;
  const cy = H / 2;
  const ring1 = connectionsOf(node, graph);
  const pos = new Map<string, { x: number; y: number; n: GraphNode; level: 0 | 1 | 2 }>();
  pos.set(node.id, { x: cx, y: cy, n: node, level: 0 });
  ring1.forEach((c, k) => {
    const a = (k / Math.max(ring1.length, 1)) * Math.PI * 2 - Math.PI / 2;
    pos.set(c.other.id, { x: cx + Math.cos(a) * 190, y: cy + Math.sin(a) * 170, n: c.other, level: 1 });
  });
  const outer: [string, string][] = [];
  ring1.forEach((c, k) => {
    const base = (k / Math.max(ring1.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const kids = connectionsOf(c.other, graph)
      .filter((x) => !pos.has(x.other.id))
      .slice(0, 3);
    kids.forEach((x, m) => {
      if (pos.has(x.other.id)) return;
      const a = base + (m - (kids.length - 1) / 2) * 0.42;
      pos.set(x.other.id, { x: cx + Math.cos(a) * 360, y: cy + Math.sin(a) * 235, n: x.other, level: 2 });
      outer.push([c.other.id, x.other.id]);
    });
  });
  const activate = (n: GraphNode) => {
    if (n.id !== node.id) onSelect(n);
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label={tx('graphAria', { name: node.label })}>
      {outer.map(([a, b]) => {
        const p = pos.get(a)!;
        const q = pos.get(b)!;
        return <line key={`${a}>${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="stroke-border" strokeWidth={1.2} />;
      })}
      {ring1.map((c) => {
        const q = pos.get(c.other.id)!;
        return (
          <g key={c.other.id}>
            <line x1={cx} y1={cy} x2={q.x} y2={q.y} className="stroke-muted-foreground" strokeWidth={1.2} />
            <text
              x={(cx + q.x) / 2}
              y={(cy + q.y) / 2}
              textAnchor="middle"
              className="fill-muted-foreground stroke-card text-[10px]"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {words.relation(c).toLowerCase()}
            </text>
          </g>
        );
      })}
      {[...pos.values()].map(({ x, y, n, level }) => {
        const r = level === 0 ? 16 : level === 1 ? 10 : 6;
        const below = y >= cy;
        return (
          <g
            key={n.id}
            role="button"
            tabIndex={level === 0 ? -1 : 0}
            aria-label={n.label}
            onClick={() => activate(n)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate(n);
              }
            }}
            className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-ring"
          >
            <circle cx={x} cy={y} r={r} fill={NODE_TYPE_CONFIG[n.nodeType]?.color} className="stroke-card" strokeWidth={2.5} />
            <text
              x={x}
              y={below ? y + r + 14 : y - r - 7}
              textAnchor="middle"
              className="fill-foreground stroke-card text-xs font-medium"
              strokeWidth={3}
              paintOrder="stroke"
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
