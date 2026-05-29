import { apiFetch } from '@/lib/api-client';

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
  edgeType: 'relation' | 'location' | 'type_hierarchy' | 'fork';
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
  /** Free-text location field (legacy / name-matched) */
  locationField?: string;
  /**
   * Resolved location FK field returned by DRF serializers as either a numeric ID
   * or {id, name} dict (e.g. has_current_location). Far more reliable than name
   * matching for live data.
   */
  locationFkField?: string;
}

const ENTITY_CONFIGS: EntityConfig[] = [
  {
    endpoint: '/cidoc/structures/',
    category: 'structure',
    entityType: 'ArchitecturalStructure',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'structure_type', label: 'structure_type' },
      { field: 'architectural_style', label: 'style' },
    ],
    locationField: 'location_name',
    locationFkField: 'has_current_location',
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

/**
 * Django ContentType `model` field → frontend InstanceCategory.
 * Used to translate HeritageAssertion subject/object pointers into node IDs.
 */
const DJANGO_MODEL_TO_CATEGORY: Record<string, InstanceCategory> = {
  person: 'person',
  location: 'location',
  event: 'event',
  historicalperiod: 'period',
  tradition: 'tradition',
  source: 'source',
  deity: 'deity',
  guthi: 'guthi',
  architecturalstructure: 'structure',
  ritualevent: 'ritual',
  festival: 'festival',
  iconographicobject: 'iconography',
  monument: 'monument',
};

interface AcceptedAssertionRow {
  content_type_name?: string;
  object_id?: number | string | null;
  object_entity_type?: string;
  object_entity_id?: number | string | null;
  object_object_id?: number | string | null;
  asserted_property?: string;
  reconciliation_status?: string;
}

/**
 * Convert a HeritageAssertion row into (sourceNodeId, targetNodeId, label).
 * Returns null when either side maps to a class not visible in the graph
 * (e.g. CasteGroup, KumariTenure) — `addEdge` would drop them anyway.
 */
function assertionToEdge(
  a: AcceptedAssertionRow,
): { source: string; target: string; label: string } | null {
  const subjModel = (a.content_type_name || '').toLowerCase();
  const objModel = (a.object_entity_type || '').toLowerCase();
  const subjCat = DJANGO_MODEL_TO_CATEGORY[subjModel];
  const objCat = DJANGO_MODEL_TO_CATEGORY[objModel];
  if (!subjCat || !objCat) return null;

  const subjPk = a.object_id ?? null;          // model PK of the subject row
  const objPk = a.object_entity_id ?? a.object_object_id ?? null;
  if (subjPk == null || objPk == null) return null;

  const prop = a.asserted_property || '';
  // 'relationship.member_of' → 'member_of'; bare property names pass through.
  const label = prop.startsWith('relationship.') ? prop.slice('relationship.'.length) : prop;

  return {
    source: `${subjCat}_${subjPk}`,
    target: `${objCat}_${objPk}`,
    label: label || 'related_to',
  };
}

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
    const res = await apiFetch(nextUrl, { headers, signal });
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
  options?: { signal?: AbortSignal },
): Promise<InstanceGraphData> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const external = options?.signal;
  if (external) {
    if (external.aborted) {
      clearTimeout(timeout);
      return { nodes: [], edges: [], isDemo: false };
    }
    external.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let results: PromiseSettledResult<{ config: EntityConfig; data: Record<string, unknown>[] }>[];
  let assertionRows: AcceptedAssertionRow[] = [];

  try {
    const entityResults = Promise.allSettled(
      ENTITY_CONFIGS.map(async (config) => {
        const data = await fetchAllPages(
          apiBaseUrl + config.endpoint,
          headers,
          controller.signal,
        );
        return { config, data };
      }),
    );
    // HeritageAssertion edges live in their own endpoint, separate from per-resource fields.
    const assertionsPromise = fetchAllPages(
      `${apiBaseUrl}/cidoc/assertions/?reconciliation_status=accepted`,
      headers,
      controller.signal,
    )
      .then((rows) => rows as AcceptedAssertionRow[])
      .catch(() => [] as AcceptedAssertionRow[]);
    [results, assertionRows] = await Promise.all([entityResults, assertionsPromise]);
  } catch (err) {
    if (controller.signal.aborted || (err as Error).name === 'AbortError') {
      return { nodes: [], edges: [], isDemo: false };
    }
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

      // Strong location edge: serializer-resolved FK (numeric id or {id,name} dict)
      if (config.locationFkField) {
        const fk = item[config.locationFkField];
        let targetLocationId: string | undefined;
        if (typeof fk === 'number' || typeof fk === 'string') {
          const id = 'location_' + fk;
          if (nodeIdSet.has(id)) targetLocationId = id;
        } else if (fk && typeof fk === 'object') {
          const inner = (fk as { id?: number | string; name?: string }).id;
          if (inner !== undefined) {
            const id = 'location_' + inner;
            if (nodeIdSet.has(id)) targetLocationId = id;
          }
          if (!targetLocationId && (fk as { name?: string }).name) {
            targetLocationId = resolveNameToNode(String((fk as { name?: string }).name), 'location');
          }
        }
        if (targetLocationId) {
          addEdge(sourceId, targetLocationId, 'has_current_location', 'location');
        }
      }

      // Weaker location edge: free-text name match (legacy fallback)
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

  // HeritageAssertion edges (the actual KG cross-entity relationships).
  // Each accepted assertion projects to an RDF triple in Oxigraph; mirror that
  // structure in the UI graph so users see the same connectivity.
  for (const row of assertionRows) {
    const edge = assertionToEdge(row);
    if (!edge) continue;
    addEdge(edge.source, edge.target, edge.label, 'relation');
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
        addEdge(group[i], group[j], 'co_located', 'location');
      }
    }
  }

  // ── Semantic description-based edges (lightweight NLP) ──
  //
  // Conservative inference: only emit a `mentions` edge when:
  //  - description is rich (>= 30 chars after trim)
  //  - target name is reasonably specific (>= 8 chars)
  //  - target name appears as a whole-word match (no substring noise)
  //  - source and target are not already connected
  // This avoids the previous behavior where short common prefixes (e.g. "Patan")
  // produced false-positive edges to every entity sharing the prefix.
  const importantNames: { needle: string; id: string; cat: InstanceCategory }[] = [];
  for (const n of nodes) {
    const name = n.label.toLowerCase().trim();
    if (name.length < 8) continue;
    importantNames.push({ needle: name, id: n.id, cat: n.category });
  }

  const edgeKeySet = new Set(edges.map((e) => e.source + '→' + e.target));

  // Pre-compile word-boundary regexes once (escape special chars)
  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  const nameRegexes = importantNames.map((n) => ({
    ...n,
    re: new RegExp('\\b' + escapeRegex(n.needle) + '\\b', 'i'),
  }));

  for (const node of nodes) {
    const desc = (node.description || '').trim();
    if (desc.length < 30) continue;

    for (const candidate of nameRegexes) {
      if (candidate.id === node.id) continue;
      // Skip same-category unless location (avoids noisy same-type edges)
      if (candidate.cat === node.category && candidate.cat !== 'location') continue;
      if (!candidate.re.test(desc)) continue;

      const key = node.id + '→' + candidate.id;
      const rev = candidate.id + '→' + node.id;
      if (edgeKeySet.has(key) || edgeKeySet.has(rev)) continue;
      edgeKeySet.add(key);
      addEdge(node.id, candidate.id, 'mentions', 'relation');
    }
  }

  return { nodes, edges, isDemo: false };
}

/* ══════════════════════════════════════════════════════
 *  Fork edges: fetch CulturalEntity fork relationships
 * ══════════════════════════════════════════════════════ */

export async function fetchForkEdges(
  apiBaseUrl: string,
  token?: string,
): Promise<{ nodes: InstanceNode[]; edges: InstanceEdge[] }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const nodes: InstanceNode[] = [];
  const edges: InstanceEdge[] = [];
  const nodeIdSet = new Set<string>();

  try {
    const res = await apiFetch(
      `${apiBaseUrl}/data/api/cultural-entities/?page_size=200`,
      { headers }
    );
    const data = await res.json();
    const entities = data.results || data || [];

    let eid = 0;
    for (const entity of entities) {
      const nodeId = `ce_${entity.entity_id}`;
      if (!nodeIdSet.has(nodeId)) {
        nodeIdSet.add(nodeId);
        nodes.push({
          id: nodeId,
          label: entity.name,
          category: 'tradition' as InstanceCategory,
          entityType: 'cultural_entity',
          description: entity.description || '',
          apiEndpoint: `/data/api/cultural-entities/${entity.entity_id}/`,
          rawData: entity,
        });
      }
      if (entity.parent_entity) {
        const parentId = `ce_${entity.parent_entity}`;
        edges.push({
          id: `fork_e_${eid++}`,
          source: parentId,
          target: nodeId,
          label: 'fork',
          edgeType: 'fork',
        });
      }
    }
  } catch {
    // silently fail
  }

  return { nodes, edges };
}

export function mergeForkData(
  base: InstanceGraphData,
  forkData: { nodes: InstanceNode[]; edges: InstanceEdge[] },
): InstanceGraphData {
  const existingNodeIds = new Set(base.nodes.map((n) => n.id));
  const newNodes = forkData.nodes.filter((n) => !existingNodeIds.has(n.id));
  return {
    ...base,
    nodes: [...base.nodes, ...newNodes],
    edges: [...base.edges, ...forkData.edges],
  };
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
