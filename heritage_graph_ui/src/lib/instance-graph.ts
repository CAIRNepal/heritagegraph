/**
 * HeritageGraph — Live Instance Data Graph
 *
 * Fetches real heritage records (all pages) from the CIDOC backend API
 * and builds Cytoscape-compatible nodes + edges for the knowledge graph.
 *
 * Key optimisation decisions:
 *  - All entity types are fetched concurrently (Promise.allSettled)
 *  - Paginated responses are followed to completion (limit/offset)
 *  - Edge building uses a name index + partial-match for cross-entity links
 *  - Co-location edges are capped to avoid dense clusters
 *  - Description-based NLP links supplement explicit field edges
 */

/* ══════════════════════════════════════════════════════
 *  Types
 * ══════════════════════════════════════════════════════ */

export type InstanceCategory =
  | 'structure'
  | 'deity'
  | 'person'
  | 'location'
  | 'event'
  | 'ritual'
  | 'festival'
  | 'guthi'
  | 'monument'
  | 'iconography'
  | 'period'
  | 'tradition'
  | 'source';

export interface InstanceNode {
  id: string;
  label: string;
  category: InstanceCategory;
  entityType: string;
  description: string;
  apiEndpoint: string;
  rawData: Record<string, unknown>;
}

export interface InstanceEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  edgeType: 'relation' | 'location' | 'type_hierarchy';
}

export interface InstanceGraphData {
  nodes: InstanceNode[];
  edges: InstanceEdge[];
  isDemo?: boolean;
}

/* ══════════════════════════════════════════════════════
 *  Category colours — distinct from ontology schema colours
 * ══════════════════════════════════════════════════════ */

export const INSTANCE_CATEGORY_COLORS: Record<
  InstanceCategory,
  { bg: string; border: string; text: string; label: string; icon: string }
> = {
  structure:    { bg: '#3b82f6', border: '#2563eb', text: '#fff', label: 'Structures',   icon: '🏛️' },
  deity:        { bg: '#8b5cf6', border: '#7c3aed', text: '#fff', label: 'Deities',      icon: '🙏' },
  person:       { bg: '#10b981', border: '#059669', text: '#fff', label: 'People',        icon: '👤' },
  location:     { bg: '#06b6d4', border: '#0891b2', text: '#fff', label: 'Places',        icon: '📍' },
  event:        { bg: '#f59e0b', border: '#d97706', text: '#fff', label: 'Events',        icon: '📅' },
  ritual:       { bg: '#ef4444', border: '#dc2626', text: '#fff', label: 'Rituals',       icon: '🔥' },
  festival:     { bg: '#f97316', border: '#ea580c', text: '#fff', label: 'Festivals',     icon: '🎉' },
  guthi:        { bg: '#14b8a6', border: '#0d9488', text: '#fff', label: 'Guthis',        icon: '🏘️' },
  monument:     { bg: '#6366f1', border: '#4f46e5', text: '#fff', label: 'Monuments',     icon: '🗿' },
  iconography:  { bg: '#ec4899', border: '#db2777', text: '#fff', label: 'Iconography',   icon: '🎨' },
  period:       { bg: '#84cc16', border: '#65a30d', text: '#fff', label: 'Periods',       icon: '⏳' },
  tradition:    { bg: '#a855f7', border: '#9333ea', text: '#fff', label: 'Traditions',    icon: '📜' },
  source:       { bg: '#78716c', border: '#57534e', text: '#fff', label: 'Sources',       icon: '📚' },
};

/* ══════════════════════════════════════════════════════
 *  API endpoint registry
 * ══════════════════════════════════════════════════════ */

interface EntityConfig {
  endpoint: string;
  category: InstanceCategory;
  entityType: string;
  nameField: string;
  descriptionField: string;
  /** Fields that can create relation edges (name-matched to other entities) */
  relationFields: { field: string; label: string; targetCategory?: InstanceCategory }[];
  /** Field holding a location name (creates edge to location nodes) */
  locationField?: string;
}

const ENTITY_CONFIGS: EntityConfig[] = [
  {
    endpoint: '/cidoc/structures/',
    category: 'structure',
    entityType: 'ArchitecturalStructure',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'structure_type', label: 'type' },
      { field: 'architectural_style', label: 'style' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/deities/',
    category: 'deity',
    entityType: 'Deity',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'religious_tradition', label: 'tradition' },
    ],
  },
  {
    endpoint: '/cidoc/persons/',
    category: 'person',
    entityType: 'Person',
    nameField: 'name',
    descriptionField: 'biography',
    relationFields: [
      { field: 'occupation', label: 'occupation' },
    ],
  },
  {
    endpoint: '/cidoc/locations/',
    category: 'location',
    entityType: 'Location',
    nameField: 'name',
    descriptionField: 'description',
    relationFields: [
      { field: 'type', label: 'type' },
    ],
  },
  {
    endpoint: '/cidoc/events/',
    category: 'event',
    entityType: 'Event',
    nameField: 'name',
    descriptionField: 'description',
    relationFields: [
      { field: 'type', label: 'event_type' },
    ],
  },
  {
    endpoint: '/cidoc/rituals/',
    category: 'ritual',
    entityType: 'RitualEvent',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'ritual_type', label: 'ritual_type' },
      { field: 'performed_by', label: 'performed_by', targetCategory: 'person' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/festivals/',
    category: 'festival',
    entityType: 'Festival',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'festival_type', label: 'festival_type' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/guthis/',
    category: 'guthi',
    entityType: 'Guthi',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'guthi_type', label: 'guthi_type' },
    ],
    locationField: 'location',
  },
  {
    endpoint: '/cidoc/monuments/',
    category: 'monument',
    entityType: 'Monument',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'monument_type', label: 'monument_type' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/iconographic_objects/',
    category: 'iconography',
    entityType: 'IconographicObject',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'object_type', label: 'object_type' },
      { field: 'depicts_deity', label: 'depicts', targetCategory: 'deity' },
      { field: 'technique', label: 'technique' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/historical_periods/',
    category: 'period',
    entityType: 'HistoricalPeriod',
    nameField: 'name',
    descriptionField: 'description',
    relationFields: [],
  },
  {
    endpoint: '/cidoc/traditions/',
    category: 'tradition',
    entityType: 'Tradition',
    nameField: 'name',
    descriptionField: 'description',
    relationFields: [
      { field: 'type', label: 'tradition_type' },
    ],
  },
  {
    endpoint: '/cidoc/sources/',
    category: 'source',
    entityType: 'Source',
    nameField: 'title',
    descriptionField: 'authors',
    relationFields: [
      { field: 'type', label: 'source_type' },
    ],
  },
];

/* ══════════════════════════════════════════════════════
 *  Paginated fetch helper
 *  Follows limit/offset pagination to retrieve ALL records.
 * ══════════════════════════════════════════════════════ */

const PAGE_LIMIT = 200; // large page to minimise round-trips

async function fetchAllPages(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let nextUrl: string | null = url + (url.includes('?') ? '&' : '?') + 'limit=' + PAGE_LIMIT;

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers, signal });
    if (!res.ok) break;
    const json = await res.json();

    // Handle both paginated {count, next, results} and flat array responses
    if (Array.isArray(json)) {
      all.push(...json);
      break; // flat array = no pagination
    }

    const results: unknown[] = json.results ?? [];
    all.push(...(results as Record<string, unknown>[]));
    nextUrl = json.next ?? null;
  }
  return all;
}

/* ══════════════════════════════════════════════════════
 *  Main fetch: retrieve all CIDOC entities, build graph
 * ══════════════════════════════════════════════════════ */

export async function fetchInstanceGraphData(
  apiBaseUrl: string,
  token?: string,
): Promise<InstanceGraphData> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  // AbortController with a 30s timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let results: PromiseSettledResult<{ config: EntityConfig; data: Record<string, unknown>[] }>[];

  try {
    results = await Promise.allSettled(
      ENTITY_CONFIGS.map(async (config) => {
        const data = await fetchAllPages(
          apiBaseUrl + config.endpoint,
          headers,
          controller.signal,
        );
        return { config, data };
      }),
    );
  } catch {
    return { nodes: [], edges: [], isDemo: false };
  } finally {
    clearTimeout(timeout);
  }

  // ── Build nodes ─────────────────────────────────────
  const nodes: InstanceNode[] = [];
  const nodeIdSet = new Set<string>();
  const exactNameIndex = new Map<string, string>();

  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { config, data } = result.value;

    for (const item of data) {
      const id = config.category + '_' + item.id;
      const name = String(item[config.nameField] || 'Unnamed ' + config.entityType);
      const desc = String(item[config.descriptionField] || '');

      if (nodeIdSet.has(id)) continue;
      nodeIdSet.add(id);

      nodes.push({
        id,
        label: name,
        category: config.category,
        entityType: config.entityType,
        description: desc.slice(0, 300),
        apiEndpoint: config.endpoint,
        rawData: item,
      });

      const norm = name.toLowerCase().trim();
      if (norm) exactNameIndex.set(norm, id);
    }
  }

  // ── Build edges ─────────────────────────────────────
  const edges: InstanceEdge[] = [];
  let eid = 0;

  function addEdge(
    source: string,
    target: string,
    label: string,
    edgeType: InstanceEdge['edgeType'],
  ) {
    if (!source || !target || source === target) return;
    if (!nodeIdSet.has(source) || !nodeIdSet.has(target)) return;
    edges.push({ id: 'e_' + eid++, source, target, label, edgeType });
  }

  /**
   * Resolve a free-text value to a node ID.
   *  1. Exact match
   *  2. Substring match (value ⊆ label OR label ⊆ value)
   */
  function resolveNameToNode(
    value: string,
    preferCategory?: InstanceCategory,
  ): string | undefined {
    const v = value.toLowerCase().trim();
    if (!v) return undefined;

    // Exact match
    const exact = exactNameIndex.get(v);
    if (exact) return exact;

    // Substring match — prefer shorter labels (more specific)
    let bestId: string | undefined;
    let bestLen = Infinity;
    for (const [name, nodeId] of exactNameIndex) {
      if (preferCategory) {
        const cat = nodeId.split('_')[0] as InstanceCategory;
        if (cat !== preferCategory) continue;
      }
      if (name.includes(v) || v.includes(name)) {
        if (name.length < bestLen) {
          bestLen = name.length;
          bestId = nodeId;
        }
      }
    }
    return bestId;
  }

  // Second pass: explicit field-based edges
  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { config, data } = result.value;

    for (const item of data) {
      const sourceId = config.category + '_' + item.id;

      // Location edges
      if (config.locationField) {
        const loc = item[config.locationField];
        if (loc && typeof loc === 'string' && loc.trim()) {
          const targetId = resolveNameToNode(loc, 'location');
          if (targetId) addEdge(sourceId, targetId, 'located_at', 'location');
        }
      }

      // Relation-field edges
      for (const rel of config.relationFields) {
        const val = item[rel.field];
        if (!val || typeof val !== 'string' || !val.trim()) continue;
        const targetId = resolveNameToNode(val, rel.targetCategory);
        if (targetId) addEdge(sourceId, targetId, rel.label, 'relation');
      }

      // Special: guthis → managed structures
      if (config.category === 'guthi' && item.managed_structures) {
        for (const s of String(item.managed_structures).split(',')) {
          const targetId = resolveNameToNode(s, 'structure');
          if (targetId) addEdge(sourceId, targetId, 'manages', 'relation');
        }
      }

      // Special: iconographic objects → deities
      if (config.category === 'iconography' && item.depicts_deity) {
        const targetId = resolveNameToNode(String(item.depicts_deity), 'deity');
        if (targetId) addEdge(sourceId, targetId, 'depicts', 'relation');
      }
    }
  }

  // ── Co-location edges ──
  const locGroups = new Map<string, string[]>();
  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { config, data } = result.value;
    if (!config.locationField) continue;
    for (const item of data) {
      const loc = item[config.locationField];
      if (!loc || typeof loc !== 'string') continue;
      const key = String(loc).toLowerCase().trim();
      if (!key) continue;
      const nodeId = config.category + '_' + item.id;
      if (!locGroups.has(key)) locGroups.set(key, []);
      locGroups.get(key)!.push(nodeId);
    }
  }
  for (const [, group] of locGroups) {
    if (group.length < 2 || group.length > 6) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        addEdge(group[i], group[j], 'co-located', 'location');
      }
    }
  }

  // ── Semantic description-based edges (lightweight NLP) ──
  const importantNames = new Map<string, { id: string; cat: InstanceCategory }>();
  for (const n of nodes) {
    const name = n.label.toLowerCase().trim();
    if (name.length >= 4) {
      importantNames.set(name, { id: n.id, cat: n.category });
    }
  }

  const edgeKeySet = new Set(edges.map((e) => e.source + '→' + e.target));

  for (const node of nodes) {
    const desc = (node.description || '').toLowerCase();
    if (desc.length < 10) continue;

    for (const [name, target] of importantNames) {
      if (target.id === node.id) continue;
      // Skip same-category unless location (avoids noisy same-type edges)
      if (target.cat === node.category && target.cat !== 'location') continue;
      if (name.length < 5) continue;
      if (!desc.includes(name)) continue;

      const key = node.id + '→' + target.id;
      const rev = target.id + '→' + node.id;
      if (edgeKeySet.has(key) || edgeKeySet.has(rev)) continue;
      edgeKeySet.add(key);
      addEdge(node.id, target.id, 'mentions', 'relation');
    }
  }

  return { nodes, edges, isDemo: false };
}

/* ══════════════════════════════════════════════════════
 *  Helper: get instance stats
 * ══════════════════════════════════════════════════════ */

export function getInstanceStats(data: InstanceGraphData) {
  const byCategory = new Map<InstanceCategory, number>();
  for (const node of data.nodes) {
    byCategory.set(node.category, (byCategory.get(node.category) || 0) + 1);
  }
  return {
    totalEntities: data.nodes.length,
    totalRelationships: data.edges.length,
    relationEdges: data.edges.filter((e) => e.edgeType === 'relation').length,
    locationEdges: data.edges.filter((e) => e.edgeType === 'location').length,
    categories: byCategory.size,
    byCategory: Object.fromEntries(byCategory),
  };
}
