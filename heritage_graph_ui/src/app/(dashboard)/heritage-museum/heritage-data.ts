// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeType =
  | 'region'
  | 'temple'
  | 'stupa'
  | 'palace'
  | 'city'
  | 'deity'
  | 'festival'
  | 'period'
  | 'culture'
  | 'sacred_site';

export interface HeritageRelation {
  predicate: string;
  targetId: string;
  targetLabel?: string;
}

export interface HeritageNode {
  id: string;
  label: string;
  nodeType: NodeType;
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

// ── Node type visual config ────────────────────────────────────────────────────

export const NODE_TYPE_CONFIG: Record<
  NodeType,
  { color: string; glowColor: string; emoji: string; label: string }
> = {
  region:     { color: '#10b981', glowColor: '#34d399', emoji: '🏔',  label: 'Region' },
  temple:     { color: '#f59e0b', glowColor: '#fcd34d', emoji: '🛕',  label: 'Temple' },
  stupa:      { color: '#8b5cf6', glowColor: '#a78bfa', emoji: '☸',   label: 'Stupa' },
  palace:     { color: '#ec4899', glowColor: '#f472b6', emoji: '🏛',  label: 'Palace' },
  city:       { color: '#06b6d4', glowColor: '#22d3ee', emoji: '🏙',  label: 'City' },
  deity:      { color: '#ef4444', glowColor: '#f87171', emoji: '✨',  label: 'Deity' },
  festival:   { color: '#f97316', glowColor: '#fb923c', emoji: '🎉',  label: 'Festival' },
  period:     { color: '#6366f1', glowColor: '#818cf8', emoji: '📜',  label: 'Period' },
  culture:    { color: '#14b8a6', glowColor: '#2dd4bf', emoji: '🎨',  label: 'Culture' },
  sacred_site:{ color: '#84cc16', glowColor: '#a3e635', emoji: '🌿',  label: 'Sacred Site' },
};

export const RELATION_LABELS: Record<string, string> = {
  locatedIn:      'Located in',
  partOf:         'Part of',
  associatedWith: 'Associated with',
  dedicatedTo:    'Dedicated to',
  celebratedAt:   'Celebrated at',
  builtDuring:    'Built during',
  influencedBy:   'Influenced by',
  hasArtifact:    'Has artifact',
  performedBy:    'Performed by',
  worships:       'Worships',
};

// ── JSON-LD parser ─────────────────────────────────────────────────────────────

const RELATION_PREDICATES = [
  'locatedIn', 'partOf', 'associatedWith', 'dedicatedTo', 'celebratedAt',
  'builtDuring', 'influencedBy', 'hasArtifact', 'performedBy', 'worships',
];

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

    nodes.push({
      id,
      label: item['label'] || id,
      nodeType: item['nodeType'] as NodeType,
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
