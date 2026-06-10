import { apiFetch } from '@/lib/api-client';
import {
  RDF_CLASS_URI_TO_NODE_TYPE,
  RDF_PREFIXES,
  type NodeType,
} from '@/lib/ontology/__generated__/heritage-viz-config';
import {
  getOntologyGraphData,
  type OntologyNode,
} from '@/lib/ontology/__generated__/ontology-graph';

/**
 * HeritageGraph — live Knowledge Graph reader (SPARQL-backed).
 *
 * Reads the museum's live graph from the Oxigraph **public** named graph via the
 * backend projection endpoint (`/api/v1/cidoc/kg/graph/`). Every node is typed
 * by its real `rdf:type` and every edge is a real triple — no client-side name
 * matching, NLP "mentions", or lossy category enum. Node types are resolved
 * straight from the ontology via the generated RDF_CLASS_URI_TO_NODE_TYPE table.
 */

export interface KgImageCredit {
  license?: string;
  licenseUrl?: string;
  artist?: string;
  descriptionUrl?: string;
  source?: string;
  retrieved?: string;
}

export interface KgGraphNode {
  id: string; // resource IRI
  types: string[]; // rdf:type IRIs
  label: string;
  comment: string | null;
  lat: string | null;
  long: string | null;
  /** Temporal anchor for timeline (EDTF-ish string from ORM or RDF). */
  inceptionYear?: string | null;
  /** Primary image for museum XR / map hero. */
  imageUrl?: string | null;
  images?: string[];
  imageCredits?: Record<string, KgImageCredit>;
  narrativeSource?: string | null;
  imageSource?: string | null;
  /** Identity cluster UUID (same referent within type_scope). */
  clusterId?: string | null;
  canonicalMemberId?: string | null;
  clusterLabel?: string | null;
  typeScope?: string | null;
  /** curated HeritageGraph vs linked Yale LUX stub */
  sourceLayer?: 'curated' | 'lux';
  /** Yale LUX canonical URI when this node is a linked stub */
  externalUri?: string | null;
}

export interface KgEdgeProvenance {
  source: string | null; // citation / DataSource title
  confidence: string | null;
  confidenceScore: number | null;
  assertedBy: string | null; // contributor or agent id
  temporalScope: string | null; // EDTF validity
  assertedAt: string | null; // ISO timestamp
}

export interface KgGraphEdge {
  source: string;
  target: string;
  predicate: string; // predicate IRI
  predicateLocal: string;
  predicateLabel: string;
  /** Provenance for assertion-backed edges; null for structural (FK) edges. */
  provenance?: KgEdgeProvenance | null;
}

export interface KgGraphResponse {
  graph: string; // named-graph IRI the data came from (provenance partition)
  layers?: string[];
  includeLux?: boolean;
  luxLinkCount?: number;
  nodes: KgGraphNode[];
  edges: KgGraphEdge[];
  counts: {
    nodes: number;
    edges: number;
    luxNodes?: number;
    edgesWithProvenance?: number;
  };
}

function expandCurie(curie: string): string {
  if (!curie || curie.startsWith('http://') || curie.startsWith('https://')) return curie;
  const i = curie.indexOf(':');
  if (i < 0) return curie;
  const base = (RDF_PREFIXES as Record<string, string>)[curie.slice(0, i)];
  return base ? base + curie.slice(i + 1) : curie;
}

// Lazy hierarchy index (class IRI → ontology node → parent chain), so an
// unmapped subclass still resolves to its nearest mapped ancestor.
let _byId: Map<string, OntologyNode> | null = null;
let _iriToId: Map<string, string> | null = null;
function ensureOntologyIndex(): void {
  if (_byId) return;
  _byId = new Map();
  _iriToId = new Map();
  for (const n of getOntologyGraphData().nodes) {
    _byId.set(n.id, n);
    _iriToId.set(expandCurie(n.cidocMapping), n.id);
  }
}

/** Resolve a single rdf:type IRI to a NodeType, walking up the ontology
 *  hierarchy to the nearest mapped ancestor when there is no direct mapping. */
function nodeTypeForIri(iri: string): NodeType | null {
  const direct = RDF_CLASS_URI_TO_NODE_TYPE[iri];
  if (direct) return direct;
  ensureOntologyIndex();
  let id = _iriToId!.get(iri);
  if (!id) {
    const hgLocal = iri.match(/heritagegraph\/([^/#]+)$/)?.[1];
    if (hgLocal && _byId!.has(hgLocal)) id = hgLocal;
  }
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const node = _byId!.get(id);
    if (!node) break;
    const mapped = RDF_CLASS_URI_TO_NODE_TYPE[expandCurie(node.cidocMapping)];
    if (mapped) return mapped;
    id = node.parent;
  }
  return null;
}

/** Resolve a node's rdf:type IRIs to the canonical NodeType, or null if unmapped. */
export function rdfTypeToNodeType(types: string[]): NodeType | null {
  for (const t of types) {
    const nt = nodeTypeForIri(t);
    if (nt) return nt;
  }
  return null;
}

export async function fetchKgGraph(
  apiBaseUrl: string,
  token?: string,
  options?: { signal?: AbortSignal; scope?: 'all' | 'reviewed'; includeLux?: 'linked' | 'none' },
): Promise<KgGraphResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Default to the curated graph: the public museum shows only reviewed data.
  // Callers with curator privileges may pass scope='all' to preview pending
  // entities (the backend still requires authentication to honour it).
  const scope = options?.scope ?? 'reviewed';
  const includeLux = options?.includeLux ?? 'linked';
  const params = new URLSearchParams({ scope, include_lux: includeLux });
  const res = await apiFetch(`${apiBaseUrl}/api/v1/cidoc/kg/graph/?${params}`, {
    headers,
    signal: options?.signal,
  });
  if (!res.ok) throw new Error(`kg/graph responded ${res.status}`);
  return (await res.json()) as KgGraphResponse;
}

// ── Neighborhood (click-to-expand) ────────────────────────────────────────────

export interface KgNeighborRow {
  direction: 'inbound' | 'outbound';
  predicate: string; // predicate IRI
  value: string; // neighbour IRI or literal
  valueLabel?: string;
  valueType?: string; // neighbour rdf:type IRI (present only for typed resources)
}

export interface KgNeighborhoodResponse {
  uri: string;
  edges: KgNeighborRow[];
  count: number;
}

/** Inbound + outbound edges of one resource (public graph + optional linked LUX). */
export async function fetchKgNeighborhood(
  apiBaseUrl: string,
  uri: string,
  token?: string,
  options?: { signal?: AbortSignal; limit?: number; includeLux?: 'linked' | 'none' },
): Promise<KgNeighborhoodResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const params = new URLSearchParams({
    uri,
    limit: String(options?.limit ?? 60),
    include_lux: options?.includeLux ?? 'linked',
  });
  const res = await apiFetch(`${apiBaseUrl}/api/v1/cidoc/kg/neighborhood/?${params}`, {
    headers,
    signal: options?.signal,
  });
  if (!res.ok) throw new Error(`kg/neighborhood responded ${res.status}`);
  return (await res.json()) as KgNeighborhoodResponse;
}
