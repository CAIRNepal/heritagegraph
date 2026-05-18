// ── Ontology config — generated from canonical schema ─────────────────────────
// To change node types, predicates, colors, or enums:
//   1. Edit ontology/HeritageGraph.yaml  (semantic definitions)
//      or  tools/ui-vizmap.yaml          (visual config: colors, emojis, categories)
//   2. Run: python3 tools/gen_heritage_viz_config.py
//   3. Commit all changed files together.
import type { NodeType, HgCategory } from '@/lib/ontology/__generated__/heritage-viz-config';
import { NODE_TYPE_CONFIG, RELATION_LABELS, HG_CATEGORY_CONFIG } from '@/lib/ontology/__generated__/heritage-viz-config';

export type { NodeType, HgCategory };
export { NODE_TYPE_CONFIG, RELATION_LABELS, HG_CATEGORY_CONFIG };

export interface HeritageRelation {
  predicate: string;
  targetId: string;
  targetLabel?: string;
}

export interface HeritageNode {
  id: string;
  label: string;
  nodeType: NodeType;
  cidocMapping: string;
  hgCategory: HgCategory;
  description: string;
  storyText: string;
  imageUrl?: string;
  images?: string[];
  significance?: string;
  tags?: string[];
  religion?: string;
  unescoStatus?: string;
  inceptionYear?: string;
  dynasty?: string;
  ethnicity?: string;
  period?: string;
  lat?: string;
  long?: string;
  wikipediaTitle?: string;
  keyFacts?: Array<{ label: string; value: string }>;
  rituals?: string[];
  architecture?: string;
  history?: string;
  culturalRole?: string;
  visitNote?: string;
  relations: HeritageRelation[];
}

export interface GraphNode extends HeritageNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  index?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  predicate: string;
  index?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ── JSON-LD parser ─────────────────────────────────────────────────────────────

// Derived from RELATION_LABELS so it stays in sync automatically.
const RELATION_PREDICATES = Object.keys(RELATION_LABELS);

function proxyImg(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // Return the URL directly — Wikimedia images are generally accessible
  return url;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonLd(raw: any): HeritageNode[] {
  const graph = raw['@graph'] as any[];
  const idToLabel: Record<string, string> = {};

  for (const item of graph) {
    idToLabel[item['@id']] = item['label'] || String(item['@id']).split('/').pop() || item['@id'];
  }

  const nodes: HeritageNode[] = [];

  for (const item of graph) {
    if (!item['nodeType']) continue;

    const id = item['@id'] as string;
    const relations: HeritageRelation[] = [];

    for (const pred of RELATION_PREDICATES) {
      const val = item[pred];
      if (!val) continue;
      const targets = Array.isArray(val) ? val : [val];
      for (const t of targets) {
        const targetId = typeof t === 'string' ? t : t['@id'];
        if (targetId) {
          relations.push({
            predicate: pred,
            targetId,
            targetLabel: idToLabel[targetId] || String(targetId).split(':').pop(),
          });
        }
      }
    }

    const nodeType = item['nodeType'] as NodeType;
    const typeCfg = NODE_TYPE_CONFIG[nodeType];

    nodes.push({
      id,
      label: item['label'] || id,
      nodeType,
      cidocMapping: typeCfg?.cidocMapping ?? '',
      hgCategory: (typeCfg?.hgCategory ?? 'tangible') as HgCategory,
      description: item['description'] || '',
      storyText: item['storyText'] || '',
      imageUrl: proxyImg(item['imageUrl']),
      images: Array.isArray(item['images'])
        ? (item['images'] as string[]).map(proxyImg).filter(Boolean) as string[]
        : undefined,
      significance:  item['significance'],
      tags:          item['tags'],
      religion:      item['religion'],
      unescoStatus:  item['unescoStatus'],
      inceptionYear: item['inceptionYear'],
      dynasty:       item['dynasty'],
      ethnicity:     item['ethnicity'],
      period:        item['period'],
      lat:           item['lat'],
      long:          item['long'],
      wikipediaTitle:item['wikipediaTitle'],
      keyFacts:      item['keyFacts'],
      rituals:       item['rituals'],
      architecture:  item['architecture'],
      history:       item['history'],
      culturalRole:  item['culturalRole'],
      visitNote:     item['visitNote'],
      relations,
    });
  }

  return nodes;
}

function buildGraphData(nodes: HeritageNode[]): GraphData {
  const nodeIds = new Set(nodes.map((n) => n.id));
  const graphNodes: GraphNode[] = nodes.map((n) => ({ ...n }));
  const linkSet = new Set<string>();
  const links: GraphLink[] = [];

  for (const node of nodes) {
    for (const rel of node.relations) {
      if (!nodeIds.has(rel.targetId)) continue;
      const key = `${node.id}→${rel.targetId}→${rel.predicate}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
        links.push({ source: node.id, target: rel.targetId, predicate: rel.predicate });
      }
    }
  }

  return { nodes: graphNodes, links };
}

// ── Public fetch (cached) ─────────────────────────────────────────────────────

let _cache: GraphData | null = null;

export async function fetchHeritageDemoData(): Promise<GraphData> {
  if (_cache) return _cache;
  const res = await fetch('/api/heritage-demo');
  const raw = await res.json();
  const nodes = parseJsonLd(raw);
  _cache = buildGraphData(nodes);
  return _cache;
}
