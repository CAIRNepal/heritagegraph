'use client';

import { useTranslations } from 'next-intl';

import { NEPAL_OUTLINE, NEPAL_VIEW_BOUNDS } from '@/lib/heritage-museum/nepal-outline';
import { TIMELINE_REFERENCE_PERIODS } from '@/lib/heritage-museum/timeline-layout';
import { cn } from '@/lib/utils';

import type { GraphNode } from '../../heritage-data';
import { coordsOf, yearOf } from './exhibit-utils';

const { west: W, east: E, south: S, north: N } = NEPAL_VIEW_BOUNDS;
const X = (lon: number) => lon - W;
const Y = (lat: number) => N - lat;
const OUTLINE_PATH =
  'M' + NEPAL_OUTLINE.map(([lon, lat]) => `${X(lon).toFixed(3)},${Y(lat).toFixed(3)}`).join('L') + 'Z';

interface NepalMapProps {
  nodes: GraphNode[];
  selectedId: string | null;
}

/**
 * Nepal's outline with every located record as a dot; the open one ringed.
 * A picture, not a control: at this size the dots are a few pixels across and
 * cluster in the valley, too small to tap. "Open full map" is the way to pick.
 */
export function NepalMiniMap({ nodes, selectedId }: NepalMapProps) {
  const tx = useTranslations('heritageMuseum.exhibit');
  const located = nodes
    .filter((n) => n.coordinateSource !== 'inherited')
    .map((n) => ({ n, c: coordsOf(n) }))
    .filter((x): x is { n: GraphNode; c: { lat: number; lon: number } } => x.c !== null && x.c.lon >= W && x.c.lon <= E && x.c.lat >= S && x.c.lat <= N);
  const sel = located.find((x) => x.n.id === selectedId);
  return (
    <svg viewBox={`0 0 ${(E - W).toFixed(2)} ${(N - S).toFixed(2)}`} className="block h-auto w-full" role="img" aria-label={tx('mapAria', { count: located.length })}>
      <path d={OUTLINE_PATH} className="fill-muted stroke-border" strokeWidth={0.06} />
      {located.map(({ n, c }) => (
        <circle
          key={n.id}
          cx={X(c.lon)}
          cy={Y(c.lat)}
          r={n.id === selectedId ? 0.12 : 0.07}
          className={n.id === selectedId ? 'fill-primary' : 'fill-muted-foreground opacity-55'}
        />
      ))}
      {sel ? <circle cx={X(sel.c.lon)} cy={Y(sel.c.lat)} r={0.28} className="fill-none stroke-primary" strokeWidth={0.07} /> : null}
    </svg>
  );
}

const T0 = -300;
const T1 = 2030;
const tx = (y: number) => ((y - T0) / (T1 - T0)) * 100;

export function MiniTimeline({ nodes, selectedId }: { nodes: GraphNode[]; selectedId: string | null }) {
  const tt = useTranslations('heritageMuseum.timeline');
  return (
    <div className="relative h-[54px]" aria-hidden="true">
      <span className="absolute top-[30px] right-0 left-0 h-px bg-border" />
      {TIMELINE_REFERENCE_PERIODS.map((p) => (
        <span
          key={p.id}
          className="absolute top-1 grid h-4 place-items-center overflow-hidden rounded bg-muted text-[10px] whitespace-nowrap text-muted-foreground"
          style={{ left: `${tx(p.startYear)}%`, width: `${tx(p.endYear) - tx(p.startYear)}%` }}
        >
          {tt(p.labelKey)}
        </span>
      ))}
      {nodes.map((n) => {
        const y = yearOf(n);
        if (y == null || y < T0 || y > T1) return null;
        const on = n.id === selectedId;
        return (
          <span
            key={n.id}
            className={cn('absolute -ml-px rounded-[1px]', on ? 'top-[22px] h-[17px] w-[3px] bg-primary' : 'top-[25px] h-[11px] w-0.5 bg-muted-foreground opacity-45')}
            style={{ left: `${tx(y)}%` }}
          />
        );
      })}
      {[0, 500, 1000, 1500, 2000].map((y) => (
        <span key={y} className="absolute top-10 -translate-x-1/2 text-[10px] text-muted-foreground" style={{ left: `${tx(y)}%` }}>
          {y}
        </span>
      ))}
    </div>
  );
}
