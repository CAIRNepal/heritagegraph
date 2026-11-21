import type { GraphNode } from '@/app/(site)/heritage-museum/heritage-data';

import { parseTemporalAnchor, type TemporalAnchor } from './temporal-parse';

/** Reference intervals (CE) for Nepal Valley historiography — band labels, not point events. */
export const TIMELINE_REFERENCE_PERIODS = [
  { id: 'licchavi', startYear: 400, endYear: 880, labelKey: 'licchavi' as const },
  { id: 'malla', startYear: 1200, endYear: 1768, labelKey: 'malla' as const },
  { id: 'shah', startYear: 1768, endYear: 2008, labelKey: 'shah' as const },
] as const;

export const TIMELINE_LAYOUT_DEFAULTS = {
  canvasWidth: 1400,
  markerWidth: 40,
  /** Minimum horizontal gap (px) before markers stack into another lane. */
  minGapPx: 48,
  laneStepPx: 42,
  periodBandHeightPx: 26,
  axisOffsetPx: 36,
  bottomPaddingPx: 8,
  sidePaddingPx: 32,
} as const;

export interface TimelineLayoutMarker {
  node: GraphNode;
  anchor: TemporalAnchor;
  x: number;
  lane: number;
  /** Nodes sharing the same calendar-year anchor (after rounding). */
  yearClusterId: number;
  yearClusterIndex: number;
  yearClusterSize: number;
}

export interface TimelinePeriodBandLayout {
  id: string;
  labelKey: (typeof TIMELINE_REFERENCE_PERIODS)[number]['labelKey'];
  startYear: number;
  endYear: number;
  x0: number;
  x1: number;
}

export interface TimelineTick {
  year: number;
  x: number;
}

export interface TimelineLayout {
  width: number;
  height: number;
  minYear: number;
  maxYear: number;
  /** Y offset (px) where marker swimlanes begin (below period bands). */
  markerBaseY: number;
  axisY: number;
  laneStepPx: number;
  markers: TimelineLayoutMarker[];
  periods: TimelinePeriodBandLayout[];
  ticks: TimelineTick[];
  datedCount: number;
  undatedCount: number;
  uncertainCount: number;
  maxLane: number;
  yearToX: (year: number) => number;
}

function tickStep(span: number): number {
  if (span > 2000) return 500;
  if (span > 1000) return 200;
  if (span > 400) return 100;
  return 50;
}

/**
 * Greedy lane assignment: markers that would overlap horizontally are placed on
 * separate swimlanes (common approach in genome browsers & dense event timelines).
 */
function assignLanes(xs: number[], minGap: number): number[] {
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const lanes = new Array<number>(xs.length).fill(0);
  const laneRight: number[] = [];

  for (const i of order) {
    const x = xs[i];
    let lane = 0;
    while (lane < laneRight.length && x - laneRight[lane] < minGap) {
      lane += 1;
    }
    lanes[i] = lane;
    laneRight[lane] = x;
  }
  return lanes;
}

export function buildTimelineLayout(
  nodes: GraphNode[],
  options: Partial<typeof TIMELINE_LAYOUT_DEFAULTS> = {},
): TimelineLayout | null {
  const cfg = { ...TIMELINE_LAYOUT_DEFAULTS, ...options };
  const dated: { node: GraphNode; anchor: TemporalAnchor }[] = [];

  for (const node of nodes) {
    const anchor = parseTemporalAnchor(node.inceptionYear);
    if (anchor) dated.push({ node, anchor });
  }

  if (dated.length === 0) return null;

  const nodeYears = dated.map((d) => d.anchor.year);
  const periodStarts = TIMELINE_REFERENCE_PERIODS.map((p) => p.startYear);
  const periodEnds = TIMELINE_REFERENCE_PERIODS.map((p) => p.endYear);
  const minYear = Math.min(...nodeYears, ...periodStarts);
  const maxYear = Math.max(
    ...nodeYears,
    ...periodEnds,
    new Date().getUTCFullYear(),
  );
  const span = Math.max(1, maxYear - minYear);
  const innerWidth = cfg.canvasWidth - cfg.sidePaddingPx * 2;

  const yearToX = (year: number): number =>
    cfg.sidePaddingPx +
    ((year - minYear) / span) * (innerWidth - cfg.markerWidth) +
    cfg.markerWidth / 2;

  const xs = dated.map((d) => yearToX(d.anchor.year));
  const lanes = assignLanes(xs, cfg.minGapPx);

  const yearGroups = new Map<number, number[]>();
  dated.forEach((_, i) => {
    const y = dated[i].anchor.year;
    const list = yearGroups.get(y) ?? [];
    list.push(i);
    yearGroups.set(y, list);
  });

  const markers: TimelineLayoutMarker[] = dated.map((d, i) => {
    const clusterIndices = yearGroups.get(d.anchor.year) ?? [i];
    const yearClusterIndex = clusterIndices.indexOf(i);
    return {
      node: d.node,
      anchor: d.anchor,
      x: xs[i],
      lane: lanes[i],
      yearClusterId: d.anchor.year,
      yearClusterIndex,
      yearClusterSize: clusterIndices.length,
    };
  });

  const maxLane = markers.reduce((m, mk) => Math.max(m, mk.lane), 0);
  const markerBaseY = cfg.periodBandHeightPx + 6;
  const axisY = markerBaseY + (maxLane + 1) * cfg.laneStepPx + 20;

  const periods: TimelinePeriodBandLayout[] = TIMELINE_REFERENCE_PERIODS.map((p) => ({
    id: p.id,
    labelKey: p.labelKey,
    startYear: p.startYear,
    endYear: p.endYear,
    x0: yearToX(p.startYear),
    x1: yearToX(p.endYear),
  }));

  const step = tickStep(span);
  const start = Math.ceil(minYear / step) * step;
  const ticks: TimelineTick[] = [];
  for (let y = start; y <= maxYear; y += step) {
    ticks.push({ year: y, x: yearToX(y) });
  }

  const height = axisY + cfg.bottomPaddingPx + 8;

  return {
    width: cfg.canvasWidth,
    height,
    minYear,
    maxYear,
    markerBaseY,
    axisY,
    laneStepPx: cfg.laneStepPx,
    markers,
    periods,
    ticks,
    datedCount: dated.length,
    undatedCount: nodes.length - dated.length,
    uncertainCount: dated.filter((d) => d.anchor.uncertain).length,
    maxLane,
    yearToX,
  };
}
