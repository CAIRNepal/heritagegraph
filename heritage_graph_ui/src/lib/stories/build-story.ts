/**
 * Turns the live knowledge graph into stories.
 *
 * A story starts at one record and follows its edges. Edges that raise the
 * same question are one stop ("Where does it stand?" gathers `stands in`,
 * `is located at` and `is housed in`), so a district with forty temples is a
 * single stop listing them, not forty. Nothing here writes prose: every line a
 * story shows is a record's own label, description or an edge, each with the
 * provenance the graph already carries.
 */

import {
  rdfTypeToNodeType,
  type KgEdgeProvenance,
  type KgGraphEdge,
  type KgGraphNode,
  type KgGraphResponse,
  type KgImageCredit,
} from '@/lib/kg-graph';
import { NODE_TYPE_CONFIG } from '@/lib/ontology/__generated__/heritage-viz-config';

import {
  humanizePredicate,
  NON_NARRATIVE,
  relationFor,
  type Question,
  type ThemeKind,
} from './grammar';

export interface StoryRecord {
  id: string;
  segment: string;
  pk: string;
  label: string;
  labelNe: string | null;
  typeLabel: string;
  comment: string | null;
  imageUrl: string | null;
  imageCredit: KgImageCredit | null;
  degree: number;
  node: KgGraphNode;
}

export interface StoryLink {
  record: StoryRecord;
  /** The edge read in the direction the story walks it. */
  phrase: string;
  direction: 'out' | 'in';
  provenance: KgEdgeProvenance | null;
}

export interface StoryStop {
  key: string;
  question: Question;
  kind: ThemeKind;
  direction: 'out' | 'in';
  /** Position in the story: the grammar's order, inbound just after outbound. */
  order: number;
  links: StoryLink[];
}

export interface Story {
  focus: StoryRecord;
  stops: StoryStop[];
  /** Records the focus cites (`cites` edges). */
  sources: StoryRecord[];
}

export interface GraphIndex {
  nodes: Map<string, KgGraphNode>;
  out: Map<string, KgGraphEdge[]>;
  in: Map<string, KgGraphEdge[]>;
  degree: Map<string, number>;
}

const RESOURCE = /\/resource\/([^/]+)\/([^/?#]+)$/;

export function recordRef(iri: string): { segment: string; pk: string } | null {
  const m = RESOURCE.exec(iri);
  return m ? { segment: m[1], pk: m[2] } : null;
}

export function indexGraph(graph: Pick<KgGraphResponse, 'nodes' | 'edges'>): GraphIndex {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const out = new Map<string, KgGraphEdge[]>();
  const inbound = new Map<string, KgGraphEdge[]>();
  const degree = new Map<string, number>();
  for (const e of graph.edges) {
    if (!nodes.has(e.source) || !nodes.has(e.target) || e.source === e.target) continue;
    (out.get(e.source) ?? out.set(e.source, []).get(e.source)!).push(e);
    (inbound.get(e.target) ?? inbound.set(e.target, []).get(e.target)!).push(e);
    if (!NON_NARRATIVE.has(e.predicateLocal)) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
  }
  return { nodes, out, in: inbound, degree };
}

function typeLabel(node: KgGraphNode, segment: string): string {
  const nt = rdfTypeToNodeType(node.types);
  if (nt && NODE_TYPE_CONFIG[nt]) return NODE_TYPE_CONFIG[nt].label;
  return segment.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** A label in Devanagari, if the record has one in Nepali or Nepal Bhasa. */
function nepaliLabel(node: KgGraphNode): string | null {
  const labels = node.labels ?? {};
  const ne = labels.ne ?? labels.new ?? null;
  if (ne && ne !== node.label) return ne;
  return null;
}

export function toRecord(index: GraphIndex, id: string): StoryRecord | null {
  const node = index.nodes.get(id);
  const ref = node ? recordRef(node.id) : null;
  if (!node || !ref) return null;
  const imageUrl = node.imageUrl ?? null;
  return {
    id: node.id,
    segment: ref.segment,
    pk: ref.pk,
    label: node.label,
    labelNe: nepaliLabel(node),
    typeLabel: typeLabel(node, ref.segment),
    comment: node.comment && node.comment !== node.label ? node.comment : null,
    imageUrl,
    imageCredit: (imageUrl && node.imageCredits?.[imageUrl]) || null,
    degree: index.degree.get(node.id) ?? 0,
    node,
  };
}

/** Featured first: a photograph, then a Nepali label, then the most connected. */
function rankLinks(a: StoryLink, b: StoryLink): number {
  const score = (l: StoryLink) =>
    (l.record.imageUrl ? 4 : 0) + (l.record.labelNe ? 2 : 0) + (l.record.comment ? 1 : 0);
  return (
    score(b) - score(a) ||
    b.record.degree - a.record.degree ||
    a.record.label.localeCompare(b.record.label)
  );
}

export function buildStory(index: GraphIndex, focusId: string, maxStops = 7): Story | null {
  const focus = toRecord(index, focusId);
  if (!focus) return null;

  const stops = new Map<string, StoryStop>();
  const sources: StoryRecord[] = [];
  const seen = new Set<string>();

  const visit = (edge: KgGraphEdge, direction: 'out' | 'in') => {
    const otherId = direction === 'out' ? edge.target : edge.source;
    const other = toRecord(index, otherId);
    if (!other) return;
    if (edge.predicateLocal === 'cites') {
      if (direction === 'out') sources.push(other);
      return;
    }
    if (NON_NARRATIVE.has(edge.predicateLocal)) return;
    const dedupe = `${direction}|${edge.predicateLocal}|${otherId}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);

    const relation = relationFor(edge.predicateLocal);
    const question = relation
      ? direction === 'out'
        ? relation.out
        : relation.in
      : { en: 'What else is it tied to?' };
    const key = `${direction}|${question.en}`;
    const stop =
      stops.get(key) ??
      stops
        .set(key, {
          key,
          question,
          kind: relation?.kind ?? 'tie',
          direction,
          order: (relation?.order ?? 9) + (direction === 'in' ? 0.5 : 0),
          links: [],
        })
        .get(key)!;
    stop.links.push({
      record: other,
      phrase: relation
        ? direction === 'out'
          ? relation.phrase
          : relation.inversePhrase
        : humanizePredicate(edge.predicateLocal),
      direction,
      provenance: edge.provenance ?? null,
    });
  };

  for (const e of index.out.get(focusId) ?? []) visit(e, 'out');
  for (const e of index.in.get(focusId) ?? []) visit(e, 'in');

  const ranked = [...stops.values()]
    .map((s) => ({ ...s, links: [...s.links].sort(rankLinks) }))
    .sort((a, b) => a.order - b.order || b.links.length - a.links.length)
    .slice(0, maxStops);

  return { focus, stops: ranked, sources };
}

/** How many distinct questions a record can answer: its story's length. */
export function storyLength(index: GraphIndex, id: string): number {
  return buildStory(index, id)?.stops.length ?? 0;
}

/**
 * How much a story has to tell. A district's story is mostly "what lies within
 * it"; a festival's reaches belief, place and people. Distinct kinds of
 * question count for more than the number of stops.
 */
export function storyScore(story: Story): number {
  const kinds = new Set(story.stops.map((s) => s.kind));
  const beyondPlace = [...kinds].filter((k) => k !== 'place').length;
  return (
    beyondPlace * 3 +
    story.stops.length +
    // A story page leads with its photograph; one without reads as unfinished.
    (story.focus.imageUrl ? 3 : 0) +
    (story.focus.labelNe ? 0.5 : 0)
  );
}

/** Records with enough to say for a story of at least `min` stops, richest first. */
export function storyReadyRecords(index: GraphIndex, min = 2): StoryRecord[] {
  const scored: { record: StoryRecord; score: number }[] = [];
  for (const id of index.nodes.keys()) {
    if ((index.degree.get(id) ?? 0) < min) continue;
    const story = buildStory(index, id);
    if (story && story.stops.length >= min) scored.push({ record: story.focus, score: storyScore(story) });
  }
  return scored
    .sort((a, b) => b.score - a.score || b.record.degree - a.record.degree || a.record.label.localeCompare(b.record.label))
    .map((s) => s.record);
}

export function storyHref(record: Pick<StoryRecord, 'segment' | 'pk'>): string {
  return `/stories/${record.segment}/${record.pk}`;
}

export function recordHref(record: Pick<StoryRecord, 'segment' | 'pk'>): string {
  return `/records/${record.segment}/${record.pk}`;
}

/** The node IRI for a `/<segment>/<pk>` route, if that record is published. */
export function findRecordId(index: GraphIndex, segment: string, pk: string): string | null {
  const suffix = `/resource/${segment}/${pk}`;
  for (const id of index.nodes.keys()) {
    if (id.endsWith(suffix)) return id;
  }
  return null;
}
