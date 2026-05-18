'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { glassCard } from '@/lib/design';
import { cn } from '@/lib/utils';

import { NODE_TYPE_CONFIG, type GraphNode } from '../heritage-data';

interface TimelineStripProps {
  nodes: GraphNode[];
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}

const TIMELINE_PERIOD_KEYS = [
  { id: 'licchavi', year: 400, labelKey: 'licchavi' as const },
  { id: 'malla', year: 1200, labelKey: 'malla' as const },
  { id: 'shah', year: 1768, labelKey: 'shah' as const },
];

// Pixel canvas the timeline draws on. Narrow enough that everything fits on a
// laptop, wide enough that the 1300-year Licchavi → modern gap remains legible.
const TIMELINE_WIDTH = 1400;
const NODE_BUTTON_WIDTH = 64;

function yearOf(node: GraphNode): number | null {
  const raw = (node.inceptionYear ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/-?\d{1,4}/);
  if (!m) return null;
  const y = parseInt(m[0], 10);
  return Number.isFinite(y) ? y : null;
}

export function TimelineStrip({ nodes, selectedId, onSelect }: TimelineStripProps) {
  const t = useTranslations('heritageMuseum.timeline');

  // Pre-compute year-keyed nodes so we can scale them along a linear axis.
  const datedNodes = useMemo(
    () =>
      nodes
        .map((n) => ({ node: n, year: yearOf(n) }))
        .filter((x): x is { node: GraphNode; year: number } => x.year !== null)
        .sort((a, b) => a.year - b.year),
    [nodes],
  );

  const { minYear, maxYear } = useMemo(() => {
    if (datedNodes.length === 0) return { minYear: 0, maxYear: 0 };
    // Anchor the axis to the earliest of (oldest node, oldest reference period)
    // and the latest of (newest node, newest reference period). This guarantees
    // every reference marker is visible.
    const periodYears = TIMELINE_PERIOD_KEYS.map((p) => p.year);
    const nodeYears = datedNodes.map((d) => d.year);
    return {
      minYear: Math.min(...nodeYears, ...periodYears),
      maxYear: Math.max(...nodeYears, ...periodYears, new Date().getUTCFullYear()),
    };
  }, [datedNodes]);

  if (datedNodes.length === 0) return null;

  const span = Math.max(1, maxYear - minYear);
  const yearToX = (year: number): number =>
    ((year - minYear) / span) * (TIMELINE_WIDTH - NODE_BUTTON_WIDTH) + NODE_BUTTON_WIDTH / 2;

  return (
    <div
      className={cn(
        glassCard,
        'relative flex-shrink-0 px-6 py-4 border-t border-border rounded-none shadow-none',
      )}
    >
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        {t('title')}
      </div>

      <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        <div className="relative" style={{ width: TIMELINE_WIDTH, height: 96 }}>
          {/* Axis */}
          <div className="absolute left-0 right-0 top-[64px] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* Year tick guides (every ~300 years) */}
          {(() => {
            const step = span > 2000 ? 500 : span > 1000 ? 200 : 100;
            const start = Math.ceil(minYear / step) * step;
            const ticks: number[] = [];
            for (let y = start; y <= maxYear; y += step) ticks.push(y);
            return ticks.map((y) => (
              <div
                key={`tick-${y}`}
                className="absolute top-[60px] h-2 w-px bg-border/60"
                style={{ left: `${yearToX(y)}px` }}
                aria-hidden="true"
              />
            ));
          })()}

          {/* Named historical periods, positioned on the actual year axis */}
          {TIMELINE_PERIOD_KEYS.map((p) => (
            <div
              key={p.id}
              className="absolute top-0 flex flex-col items-center gap-0.5 -translate-x-1/2"
              style={{ left: `${yearToX(p.year)}px` }}
            >
              <span className="text-xs text-primary font-medium whitespace-nowrap">{t(p.labelKey)}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {t('ce', { year: p.year })}
              </span>
              <span className="block w-px h-3 bg-primary/60" aria-hidden="true" />
            </div>
          ))}

          {/* Heritage nodes */}
          {datedNodes.map(({ node, year }) => {
            const cfg = NODE_TYPE_CONFIG[node.nodeType];
            const isSelected = node.id === selectedId;
            const x = yearToX(year);
            return (
              <button
                key={node.id}
                onClick={() => onSelect(node)}
                type="button"
                title={`${node.label} (${year} CE)`}
                aria-pressed={isSelected}
                className="absolute flex flex-col items-center gap-1 group focus:outline-none -translate-x-1/2"
                style={{ left: `${x}px`, top: 68 }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-all group-hover:scale-110"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${cfg.glowColor}, ${cfg.color})`,
                    boxShadow: isSelected ? `0 0 16px ${cfg.color}` : 'none',
                    border: isSelected ? `2px solid ${cfg.glowColor}` : '2px solid transparent',
                    fontFamily:
                      "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",
                  }}
                  aria-hidden="true"
                >
                  {cfg.emoji}
                </div>
                <span className="text-[10px] text-muted-foreground/80 font-mono">{year}</span>
                {/* Hover-revealed label so dense clusters stay legible */}
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-foreground bg-card/95 border border-border rounded px-1 py-0.5 whitespace-nowrap pointer-events-none">
                  {node.label.length > 22 ? node.label.slice(0, 21) + '…' : node.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
