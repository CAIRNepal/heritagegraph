'use client';

import { useTranslations } from 'next-intl';

import { NODE_TYPE_CONFIG, type GraphData, type GraphNode } from '../../heritage-data';
import { planRing } from './ego-ring';
import { connectionsOf, heroImageOf, useExhibitWords } from './exhibit-utils';

const W = 900;
const H = 560;
/** Neighbours' own connections are drawn only when the ring is this small. */
const SECOND_RING_BELOW = 9;

export interface EgoGraphProps {
  node: GraphNode;
  graph: GraphData;
  onSelect: (node: GraphNode) => void;
}

/**
 * The selected record at the centre and its connections on a ring, each
 * relation written once; for a small ring, a few of each neighbour's own
 * connections beyond. The full list is always in the record panel.
 */
export function EgoGraph({ node, graph, onSelect }: EgoGraphProps) {
  const tx = useTranslations('heritageMuseum.exhibit');
  const tr = useTranslations('heritageMuseum.record');
  const words = useExhibitWords();
  const cx = W / 2;
  const cy = H / 2;
  const connections = connectionsOf(node, graph);
  const degree = (n: GraphNode) => connectionsOf(n, graph).length;
  const ring = planRing(
    connections,
    (c) => words.relation(c),
    (c) => (heroImageOf(c.other) ? 1000 : 0) + degree(c.other),
  );

  const at = (k: number) => {
    const a = (k / Math.max(ring.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(a) * 200, y: cy + Math.sin(a) * 175, a };
  };
  const records = ring.flatMap((e, k) => (e.kind === 'record' ? [{ e, k, ...at(k) }] : []));
  const mores = ring.flatMap((e, k) => (e.kind === 'more' ? [{ e, k, ...at(k) }] : []));

  const outer: { from: { x: number; y: number }; n: GraphNode; x: number; y: number }[] = [];
  if (ring.length < SECOND_RING_BELOW) {
    const placed = new Set([node.id, ...records.map((r) => r.e.connection.other.id)]);
    for (const r of records) {
      const kids = connectionsOf(r.e.connection.other, graph)
        .filter((x) => !placed.has(x.other.id))
        .slice(0, 3);
      kids.forEach((x, m) => {
        placed.add(x.other.id);
        const a = r.a + (m - (kids.length - 1) / 2) * 0.42;
        outer.push({ from: r, n: x.other, x: cx + Math.cos(a) * 365, y: cy + Math.sin(a) * 240 });
      });
    }
  }

  const NodeMark = ({ n, x, y, size, centre }: { n: GraphNode; x: number; y: number; size: number; centre?: boolean }) => {
    const below = y >= cy;
    return (
      <g
        role="button"
        tabIndex={centre ? -1 : 0}
        aria-label={n.label}
        onClick={() => !centre && onSelect(n)}
        onKeyDown={(ev) => {
          if (!centre && (ev.key === 'Enter' || ev.key === ' ')) {
            ev.preventDefault();
            onSelect(n);
          }
        }}
        className="cursor-pointer outline-none focus-visible:[&>rect]:stroke-story-accent"
      >
        <rect
          x={x - size}
          y={y - size}
          width={size * 2}
          height={size * 2}
          fill={centre ? 'var(--story-accent)' : NODE_TYPE_CONFIG[n.nodeType]?.color}
          className="stroke-story-paper"
          strokeWidth={2.5}
        />
        <text
          x={x}
          y={below ? y + size + 14 : y - size - 7}
          textAnchor="middle"
          className="fill-story-ink stroke-story-paper text-xs font-semibold"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {n.label}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="group" aria-label={tx('graphAria', { name: node.label })}>
      {outer.map((o) => (
        <line key={`${o.from.x},${o.from.y}>${o.n.id}`} x1={o.from.x} y1={o.from.y} x2={o.x} y2={o.y} className="stroke-story-rule-soft" strokeWidth={1.2} />
      ))}
      {[...records, ...mores].map(({ e, k, x, y }) => (
        <line key={`l${k}`} x1={cx} y1={cy} x2={x} y2={y} className={e.kind === 'more' ? 'stroke-story-rule-soft' : 'stroke-story-ink'} strokeWidth={1} strokeDasharray={e.kind === 'more' ? '4 4' : undefined} />
      ))}
      {records.map(({ e, k, x, y }) =>
        e.showRelation ? (
          <text
            key={`t${k}`}
            x={(cx + x) / 2}
            y={(cy + y) / 2}
            textAnchor="middle"
            className="fill-story-accent stroke-story-paper text-[10px] font-semibold"
            strokeWidth={3}
            paintOrder="stroke"
          >
            {words.relation(e.connection).toLowerCase()}
          </text>
        ) : null,
      )}
      {outer.map((o) => (
        <NodeMark key={o.n.id} n={o.n} x={o.x} y={o.y} size={6} />
      ))}
      {records.map(({ e, x, y }) => (
        <NodeMark key={e.connection.other.id} n={e.connection.other} x={x} y={y} size={10} />
      ))}
      {mores.map(({ e, k, x, y }) =>
        e.kind === 'more' ? (
          <g key={`m${k}`}>
            <rect x={x - 10} y={y - 10} width={20} height={20} className="fill-story-paper stroke-story-ink" strokeWidth={1} strokeDasharray="3 2" />
            <text x={x} y={y >= cy ? y + 24 : y - 17} textAnchor="middle" className="fill-story-ink-soft stroke-story-paper text-[11px] font-semibold" strokeWidth={3} paintOrder="stroke">
              {tr('moreRelation', { count: e.count, relation: e.relation.toLowerCase() })}
            </text>
          </g>
        ) : null,
      )}
      <NodeMark n={node} x={cx} y={cy} size={16} centre />
    </svg>
  );
}
