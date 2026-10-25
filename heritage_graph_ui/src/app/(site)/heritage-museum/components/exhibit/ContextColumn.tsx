'use client';

import { useTranslations } from 'next-intl';

import { NEPAL_OUTLINE, NEPAL_VIEW_BOUNDS } from '@/lib/heritage-museum/nepal-outline';
import { TIMELINE_REFERENCE_PERIODS } from '@/lib/heritage-museum/timeline-layout';
import { cn } from '@/lib/utils';

import type { GraphNode } from '../../heritage-data';
import { RecordThumb } from './CollectionRail';
import { coordsOf, placeOf, useExhibitWords, yearOf, type Connection } from './exhibit-utils';

export type LensKind = 'map' | 'timeline' | 'graph';

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

function Panel({ id, title, action, children }: { id: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className="text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function LensButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer py-1 text-[12.5px] font-medium text-primary hover:underline">
      {children}
    </button>
  );
}

interface ContextColumnProps {
  node: GraphNode;
  allNodes: GraphNode[];
  connections: Connection[];
  onSelect: (node: GraphNode) => void;
  onOpenLens: (kind: LensKind) => void;
  /** Live data shows each connection's provenance; the demo corpus has none. */
  showProvenance: boolean;
}

/** Where the record is, when it dates from, and what it connects to. */
export function ContextColumn({ node, allNodes, connections, onSelect, onOpenLens, showProvenance }: ContextColumnProps) {
  const t = useTranslations('heritageMuseum.exhibit');
  const tp = useTranslations('heritageMuseum.panel');
  const words = useExhibitWords();
  const c = coordsOf(node);
  const y = yearOf(node);
  const place = placeOf(connections);
  const dated = allNodes.some((n) => yearOf(n) != null);

  return (
    <>
      <Panel id="ctx-where" title={t('where')} action={<LensButton onClick={() => onOpenLens('map')}>{t('openMap')}</LensButton>}>
        <NepalMiniMap nodes={allNodes} selectedId={node.id} />
        <p className="text-[13px] text-foreground">
          {c ? (
            <>
              {c.lat.toFixed(3)}° N, {c.lon.toFixed(3)}° E{place ? ` · ${place.label}` : ''}
            </>
          ) : (
            <span className="text-muted-foreground">{t('noLocation')}</span>
          )}
        </p>
      </Panel>

      <Panel id="ctx-when" title={t('when')} action={dated ? <LensButton onClick={() => onOpenLens('timeline')}>{t('openTimeline')}</LensButton> : undefined}>
        <MiniTimeline nodes={allNodes} selectedId={node.id} />
        <p className="text-[13px] text-foreground">{y != null ? words.year(y) : <span className="text-muted-foreground">{t('noDate')}</span>}</p>
      </Panel>

      <Panel
        id="ctx-connected"
        title={t('connected', { count: connections.length })}
        action={connections.length ? <LensButton onClick={() => onOpenLens('graph')}>{t('openGraph')}</LensButton> : undefined}
      >
        {connections.length ? (
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {connections.map((cn_) => {
              const p = cn_.provenance;
              return (
                <li key={cn_.other.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(cn_.other)}
                    className="grid w-full cursor-pointer grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 rounded-lg px-1 py-1.5 text-left hover:bg-background"
                  >
                    <RecordThumb node={cn_.other} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-[11.5px] text-muted-foreground">{words.relation(cn_)}</span>
                      <span className="block text-[13.5px] leading-tight font-medium text-foreground">{cn_.other.label}</span>
                      {showProvenance && p && (p.source || p.assertedBy) ? (
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                          {p.source ? tp('provSource', { value: p.source }) : null}
                          {p.source && p.assertedBy ? ' · ' : null}
                          {p.assertedBy ? tp('provAgent', { value: p.assertedBy }) : null}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">{t('noConnections')}</p>
        )}
      </Panel>
    </>
  );
}
