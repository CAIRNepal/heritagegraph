'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { IconInfoCircle } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { glassCard } from '@/lib/design';
import { buildTimelineLayout } from '@/lib/heritage-museum/timeline-layout';
import { cn } from '@/lib/utils';

import { NODE_TYPE_CONFIG, type GraphNode } from '../heritage-data';

interface TimelineStripProps {
  nodes: GraphNode[];
  selectedId: string | null;
  onSelect: (node: GraphNode) => void;
}

const MARKER_SIZE = 36;

export function TimelineStrip({ nodes, selectedId, onSelect }: TimelineStripProps) {
  const t = useTranslations('heritageMuseum.timeline');
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  const layout = useMemo(() => buildTimelineLayout(nodes), [nodes]);

  const clusterPills = useMemo(() => {
    if (!layout) return [];
    const seen = new Set<number>();
    const pills: { year: number; x: number; size: number }[] = [];
    for (const m of layout.markers) {
      if (m.yearClusterSize < 2 || seen.has(m.yearClusterId)) continue;
      seen.add(m.yearClusterId);
      pills.push({ year: m.yearClusterId, x: m.x, size: m.yearClusterSize });
    }
    return pills;
  }, [layout]);

  useEffect(() => {
    const el = selectedRef.current;
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    const elRect = el.getBoundingClientRect();
    const scRect = scroller.getBoundingClientRect();
    if (elRect.left < scRect.left || elRect.right > scRect.right) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedId, layout]);

  if (!layout) return null;

  const {
    width,
    height,
    axisY,
    markerBaseY,
    laneStepPx,
    markers,
    periods,
    ticks,
    minYear,
    maxYear,
  } = layout;

  return (
    <div
      className={cn(
        glassCard,
        'relative flex-shrink-0 border-t border-border rounded-none px-4 py-3 shadow-none sm:px-6',
      )}
      role="region"
      aria-label={t('title')}
    >
      {/* Header: title, coverage stats, methods */}
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t('title')}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {t('coverage', {
            dated: layout.datedCount,
            total: nodes.length,
          })}
        </span>
        {layout.uncertainCount > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {t('uncertainCount', { count: layout.uncertainCount })}
          </span>
        ) : null}
        {layout.undatedCount > 0 ? (
          <span className="text-[11px] text-amber-700/90 dark:text-amber-400/90">
            {t('undatedExcluded', { count: layout.undatedCount })}
          </span>
        ) : null}

        <div className="ml-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
              >
                <IconInfoCircle className="h-3.5 w-3.5" aria-hidden />
                {t('methodsButton')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(22rem,90vw)] text-xs leading-relaxed" align="end">
              <p className="font-semibold text-foreground">{t('methodsTitle')}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-muted-foreground">
                <li>{t('methodsAxis')}</li>
                <li>{t('methodsPeriods')}</li>
                <li>{t('methodsUncertainty')}</li>
                <li>{t('methodsLanes')}</li>
                <li>{t('methodsProvenance')}</li>
              </ul>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                {t('axisRange', { min: minYear, max: maxYear })}
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-x-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div className="relative" style={{ width, height, minWidth: '100%' }}>
          {/* Reference period bands (intervals, not point markers) */}
          {periods.map((p) => (
            <div
              key={p.id}
              className="absolute top-0 flex items-end justify-center overflow-hidden rounded-sm border border-primary/15 bg-primary/5"
              style={{
                left: Math.min(p.x0, p.x1),
                width: Math.max(8, Math.abs(p.x1 - p.x0)),
                height: 22,
              }}
              title={t('periodInterval', {
                label: t(p.labelKey),
                start: p.startYear,
                end: p.endYear,
              })}
            >
              <span className="truncate px-1.5 pb-0.5 text-[10px] font-medium text-primary/90">
                {t(p.labelKey)}
              </span>
            </div>
          ))}

          {/* Axis */}
          <div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
            style={{ top: axisY }}
            aria-hidden
          />

          {/* Tick labels */}
          {ticks.map((tick) => (
            <div
              key={tick.year}
              className="absolute flex flex-col items-center -translate-x-1/2"
              style={{ left: tick.x, top: axisY - 18 }}
            >
              <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                {tick.year}
              </span>
              <span
                className="mt-0.5 block h-2 w-px bg-border/70"
                aria-hidden
              />
            </div>
          ))}

          {/* Same-year cluster count (rigorous disclosure of collision) */}
          {clusterPills.map((pill) => (
            <div
              key={`cluster-${pill.year}`}
              className="absolute -translate-x-1/2 rounded-full border border-border bg-card/90 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground shadow-sm"
              style={{ left: pill.x, top: axisY + 6 }}
              title={t('sameYearCluster', { year: pill.year, count: pill.size })}
            >
              {t('clusterBadge', { count: pill.size })}
            </div>
          ))}

          {/* Entity markers — lane-stacked to resolve horizontal overlap */}
          {markers.map((m) => {
            const cfg = NODE_TYPE_CONFIG[m.node.nodeType];
            const isSelected = m.node.id === selectedId;
            const top = markerBaseY + m.lane * laneStepPx;
            const ariaLabel = t('markerLabel', {
              name: m.node.label,
              when: m.anchor.displayLabel,
            });

            return (
              <button
                key={m.node.id}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                onClick={() => onSelect(m.node)}
                aria-pressed={isSelected}
                aria-label={ariaLabel}
                title={ariaLabel}
                className={cn(
                  'absolute flex flex-col items-center gap-0.5 -translate-x-1/2',
                  'group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                )}
                style={{ left: m.x, top }}
              >
                {/* Uncertainty: dashed halo (does not imply false precision) */}
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full text-base transition-transform group-hover:scale-110',
                    m.anchor.uncertain && 'ring-2 ring-dashed ring-muted-foreground/50 ring-offset-1 ring-offset-transparent',
                  )}
                  style={{
                    width: MARKER_SIZE,
                    height: MARKER_SIZE,
                    background: `radial-gradient(circle at 35% 35%, ${cfg.glowColor}, ${cfg.color})`,
                    boxShadow: isSelected ? `0 0 14px ${cfg.color}` : undefined,
                    border: isSelected
                      ? `2px solid ${cfg.glowColor}`
                      : '2px solid transparent',
                    fontFamily:
                      "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif",
                  }}
                  aria-hidden
                >
                  {cfg.emoji}
                </div>
                <span className="max-w-[72px] truncate text-center text-[9px] font-mono text-muted-foreground/90">
                  {m.anchor.uncertain ? `~${m.anchor.year}` : m.anchor.year}
                </span>
                <span className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded border border-border bg-card/95 px-1.5 py-0.5 text-[10px] text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block">
                  {m.node.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        {t('footerHint')}
      </p>
    </div>
  );
}
