// ── Types ─────────────────────────────────────────────────────────────────────
// NodeType values are HeritageGraph ontology class identifiers aligned with
// CIDOC-CRM. Namespace: https://w3id.org/heritagegraph/

export type NodeType =
  | 'Place'                   // crm:E53_Place — geographic region
  | 'Temple'                  // hg:Temple → crm:E22_Human-Made_Object
  | 'BuddhistMonument'        // hg:BuddhistMonument → crm:E22_Human-Made_Object
  | 'ArchitecturalStructure'  // crm:E22_Human-Made_Object
  | 'Settlement'              // crm:E53_Place — urban settlement
  | 'Deity'                   // crm:E28_Conceptual_Object
  | 'Festival'                // hg:Festival → crm:E7_Activity
  | 'TimeSpan'                // crm:E52_Time-Span
  | 'ReligiousTradition'      // hg:ReligiousTradition → crm:E55_Type
  | 'SacredSite';             // hg:ArchitecturalStructure → crm:E22_Human-Made_Object

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
  hgCategory: 'tangible' | 'conceptual' | 'event' | 'spatial' | 'provenance';
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
// Keys are HeritageGraph ontology class identifiers (namespace: https://w3id.org/heritagegraph/).
// cidocMapping follows the CIDOC-CRM E-number notation.

export const NODE_TYPE_CONFIG: Record<
  NodeType,
  { color: string; glowColor: string; emoji: string; label: string; cidocMapping: string; hgCategory: string }
> = {
  Place:                  { color: '#10b981', glowColor: '#34d399', emoji: '🏔', label: 'Place',                  cidocMapping: 'crm:E53_Place',                        hgCategory: 'spatial' },
  Temple:                 { color: '#f59e0b', glowColor: '#fcd34d', emoji: '🛕', label: 'Temple',                 cidocMapping: 'hg:Temple → crm:E22_Human-Made_Object', hgCategory: 'tangible' },
  BuddhistMonument:       { color: '#8b5cf6', glowColor: '#a78bfa', emoji: '☸',  label: 'Buddhist Monument',      cidocMapping: 'hg:BuddhistMonument → crm:E22',         hgCategory: 'tangible' },
  ArchitecturalStructure: { color: '#ec4899', glowColor: '#f472b6', emoji: '🏛', label: 'Architectural Structure', cidocMapping: 'crm:E22_Human-Made_Object',             hgCategory: 'tangible' },
  Settlement:             { color: '#06b6d4', glowColor: '#22d3ee', emoji: '🏙', label: 'Settlement',             cidocMapping: 'crm:E53_Place',                        hgCategory: 'spatial' },
  Deity:                  { color: '#ef4444', glowColor: '#f87171', emoji: '✨', label: 'Deity',                  cidocMapping: 'crm:E28_Conceptual_Object',             hgCategory: 'conceptual' },
  Festival:               { color: '#f97316', glowColor: '#fb923c', emoji: '🎉', label: 'Festival',               cidocMapping: 'hg:Festival → crm:E7_Activity',         hgCategory: 'event' },
  TimeSpan:               { color: '#6366f1', glowColor: '#818cf8', emoji: '📜', label: 'Time-Span',              cidocMapping: 'crm:E52_Time-Span',                    hgCategory: 'spatial' },
  ReligiousTradition:     { color: '#14b8a6', glowColor: '#2dd4bf', emoji: '🎨', label: 'Religious Tradition',    cidocMapping: 'hg:ReligiousTradition → crm:E55_Type',  hgCategory: 'conceptual' },
  SacredSite:             { color: '#84cc16', glowColor: '#a3e635', emoji: '🌿', label: 'Sacred Site',            cidocMapping: 'hg:ArchitecturalStructure → crm:E22',   hgCategory: 'tangible' },
};

// Relation labels use HeritageGraph object property names (crm:P- properties noted).
export const RELATION_LABELS: Record<string, string> = {
  has_current_location:    'has current location',   // crm:P53
  is_component_of:         'is component of',        // crm:P46i
  associated_with:         'associated with',        // hg:associated_with
  invokes_deity:           'invokes deity',           // crm:P141
  took_place_at:           'took place at',           // crm:P7
  was_produced_by_event:   'was produced by event',  // crm:P108i
  was_derived_from_source: 'was derived from source', // crm:P17i
  has_component:           'has component',           // crm:P46
  carried_out_by:          'carried out by',          // crm:P14
};

// ── JSON-LD parser ─────────────────────────────────────────────────────────────

// HeritageGraph object property IRIs used as JSON-LD predicate keys.
const RELATION_PREDICATES = [
  'has_current_location', 'is_component_of', 'associated_with', 'invokes_deity',
  'took_place_at', 'was_produced_by_event', 'was_derived_from_source',
  'has_component', 'carried_out_by',
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

    const nodeType = item['nodeType'] as NodeType;
    const typeCfg = NODE_TYPE_CONFIG[nodeType];

    nodes.push({
      id,
      label: item['label'] || id,
      nodeType,
      cidocMapping: typeCfg?.cidocMapping ?? '',
      hgCategory: (typeCfg?.hgCategory ?? 'tangible') as HeritageNode['hgCategory'],
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
