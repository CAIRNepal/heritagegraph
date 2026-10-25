/**
 * What the Heritage Museum is showing, as plain data.
 *
 * The museum and the atlas were two pages over one collection, each with its
 * own selection, search rules and URL. They are now lenses of one page, so the
 * reader's place survives a change of lens: the same record stays open, the
 * same filters stay on, and the URL names all of it so any view is citable.
 *
 * Old links still resolve. The museum wrote `?node=` and `?view=2d|map|timeline`,
 * the atlas `?selected=`; both read into the same state.
 */

import { ERAS, eraOf, type EraId } from '@/lib/heritage-atlas/atlas-model';
import {
  HG_CATEGORY_CONFIG,
  NODE_TYPE_CONFIG,
  type HgCategory,
} from '@/lib/ontology/__generated__/heritage-viz-config';
import type { GraphNode } from '@/app/(site)/heritage-museum/heritage-data';
import { parseTemporalAnchor } from '@/lib/heritage-museum/temporal-parse';

export const LENSES = ['exhibit', 'map'] as const;
export type Lens = (typeof LENSES)[number];
export type CollectionSourceParam = 'demo' | 'live';

export interface MuseumState {
  /** Null when the URL does not name one: the page picks its default. */
  source: CollectionSourceParam | null;
  node: string | null;
  lens: Lens;
  kind: HgCategory | null;
  era: EraId | null;
  q: string;
}

export const DEFAULT_STATE: MuseumState = {
  source: null,
  node: null,
  lens: 'exhibit',
  kind: null,
  era: null,
  q: '',
};

/**
 * Legacy `?view=` values from the museum's earlier modes. The timeline and
 * connections lenses were removed; their links still open the record.
 */
const LEGACY_VIEW: Record<string, Lens> = {
  map: 'map',
  '2d': 'exhibit',
  graph: 'exhibit',
  timeline: 'exhibit',
  xr: 'exhibit',
  stories: 'exhibit',
};

const isLens = (v: string | null): v is Lens => v != null && (LENSES as readonly string[]).includes(v);
const isKind = (v: string | null): v is HgCategory => v != null && v in HG_CATEGORY_CONFIG;
const isEra = (v: string | null): v is EraId => v != null && ERAS.some((e) => e.id === v);

export function parseMuseumParams(params: URLSearchParams): MuseumState {
  const lensParam = params.get('lens');
  const view = params.get('view');
  const source = params.get('source');
  const kind = params.get('kind');
  const era = params.get('era');
  return {
    source: source === 'demo' || source === 'live' ? source : null,
    node: params.get('node') ?? params.get('selected') ?? null,
    lens: isLens(lensParam) ? lensParam : (view && LEGACY_VIEW[view]) || 'exhibit',
    kind: isKind(kind) ? kind : null,
    era: isEra(era) ? era : null,
    q: (params.get('q') ?? '').slice(0, 200),
  };
}

/** Query string for a state, leaving out what is already the default. */
export function serializeMuseumParams(state: MuseumState): string {
  const p = new URLSearchParams();
  if (state.source) p.set('source', state.source);
  if (state.node) p.set('node', state.node);
  if (state.lens !== DEFAULT_STATE.lens) p.set('lens', state.lens);
  if (state.kind) p.set('kind', state.kind);
  if (state.era) p.set('era', state.era);
  if (state.q.trim()) p.set('q', state.q.trim());
  return p.toString();
}

/**
 * A record's year on the axis, read the way the timeline reads it: circa
 * dates, centuries and BCE forms count, so the timeline, the period filter
 * and the walk through time agree on which records are dated.
 */
export function yearOfNode(node: GraphNode): number | null {
  return parseTemporalAnchor(node.inceptionYear)?.year ?? null;
}

/** Does a record match the search text? Label, any-language label, type, description, tags. */
export function matchesQuery(node: GraphNode, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    node.label,
    node.labelNe,
    NODE_TYPE_CONFIG[node.nodeType]?.label,
    node.description,
    ...(node.tags ?? []),
  ];
  return hay.some((s) => (s ?? '').toLowerCase().includes(needle));
}

export interface CollectionFilter {
  kind: HgCategory | null;
  era: EraId | null;
  q: string;
}

/**
 * The collection after search and filters, in one order every lens shares, so
 * "next" in the exhibit is the same record as "next" on the map.
 */
export function filterCollection(nodes: GraphNode[], f: CollectionFilter): GraphNode[] {
  return nodes
    .filter((n) => (!f.kind || n.hgCategory === f.kind) && (!f.era || eraOf(yearOfNode(n)) === f.era) && matchesQuery(n, f.q))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** How many records fall in each period, after search and kind but before the period filter. */
export function eraCounts(nodes: GraphNode[], f: Omit<CollectionFilter, 'era'>): Record<EraId, number> {
  const counts = Object.fromEntries(ERAS.map((e) => [e.id, 0])) as Record<EraId, number>;
  for (const n of nodes) {
    if ((f.kind && n.hgCategory !== f.kind) || !matchesQuery(n, f.q)) continue;
    counts[eraOf(yearOfNode(n))]++;
  }
  return counts;
}
