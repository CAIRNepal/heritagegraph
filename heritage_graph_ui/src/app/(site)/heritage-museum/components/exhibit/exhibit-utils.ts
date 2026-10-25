import { useTranslations } from 'next-intl';

import { yearOfNode } from '@/lib/heritage-museum/museum-state';

import {
  NODE_TYPE_CONFIG,
  RELATION_LABELS,
  type GraphData,
  type GraphLink,
  type GraphNode,
  type RelationProvenance,
} from '../../heritage-data';

/** Predicates that say where a record is; the first one found names its place. */
const LOCATION_PREDICATES = new Set([
  'has_current_location',
  'P55_has_current_location',
  'located_in',
  'located_at',
  'took_place_at',
  'celebrated_at',
  'held_at',
  'performed_at',
  'housed_in',
  'based_in',
]);

export interface Connection {
  other: GraphNode;
  predicate: string;
  /** 'out': this record → other. 'in': other → this record. */
  direction: 'out' | 'in';
  provenance: RelationProvenance | null;
}

const endId = (x: string | GraphNode) => (typeof x === 'string' ? x : x.id);

export function heroImageOf(node: GraphNode): string | undefined {
  return node.imageUrl ?? node.images?.[0];
}

/**
 * A Wikimedia image at about `width` pixels instead of the original upload,
 * which can be several megabytes (Annapurna's is 1892×2739) even when it is
 * drawn as a 48px thumbnail. Other hosts are returned unchanged. Callers keep
 * the original URL for credit lookup and fall back to it if the sized one fails.
 */
export function sizedImage(url: string, width: number): string {
  if (/\/Special:FilePath\//.test(url)) {
    return `${url}${url.includes('?') ? '&' : '?'}width=${width}`;
  }
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+)\/(?!thumb\/)([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/.exec(url);
  if (m) {
    const [, base, a, ab, file] = m;
    return `${base}/thumb/${a}/${ab}/${file}/${width}px-${file}`;
  }
  return url;
}

/** Same reading as the timeline and filters (see museum-state yearOfNode). */
export function yearOf(node: GraphNode): number | null {
  return yearOfNode(node);
}

export function coordsOf(node: GraphNode): { lat: number; lon: number } | null {
  const lat = parseFloat(node.lat ?? '');
  const lon = parseFloat(node.long ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

/**
 * Every record this one connects to, in either direction, one row per record.
 * When two edges join the same pair, the specific one wins over the generic
 * "associated with", so a deity a stupa honours is listed once, as "Honours".
 */
export function connectionsOf(node: GraphNode, graph: GraphData): Connection[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const best = new Map<string, Connection>();
  const consider = (l: GraphLink) => {
    const s = endId(l.source);
    const t = endId(l.target);
    let c: Connection | null = null;
    if (s === node.id && t !== node.id) {
      const other = byId.get(t);
      if (other) c = { other, predicate: l.predicate, direction: 'out', provenance: l.provenance ?? null };
    } else if (t === node.id && s !== node.id) {
      const other = byId.get(s);
      if (other) c = { other, predicate: l.predicate, direction: 'in', provenance: l.provenance ?? null };
    }
    if (!c) return;
    const cur = best.get(c.other.id);
    if (!cur || (cur.predicate === 'associated_with' && c.predicate !== 'associated_with')) best.set(c.other.id, c);
  };
  graph.links.forEach(consider);
  return [...best.values()];
}

/** The record's place, from its first outgoing location edge. */
export function placeOf(connections: Connection[]): GraphNode | null {
  return connections.find((c) => c.direction === 'out' && LOCATION_PREDICATES.has(c.predicate))?.other ?? null;
}

/** Translated words the exhibit needs in several places. */
export function useExhibitWords() {
  const t = useTranslations('heritageMuseum.exhibit');
  return {
    year: (y: number) => (y < 0 ? t('yearBCE', { year: -y }) : t('yearCE', { year: y })),
    relation: (c: Pick<Connection, 'predicate' | 'direction'>) => {
      const key = `relations.${c.direction}.${c.predicate}`;
      if (t.has(key)) return t(key);
      const raw = RELATION_LABELS[c.predicate] ?? c.predicate.replace(/_/g, ' ');
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    },
    typeLabel: (n: GraphNode) => NODE_TYPE_CONFIG[n.nodeType]?.label ?? n.nodeType,
  };
}
