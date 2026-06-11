/**
 * Hydrates the Heritage Atlas corpus from the authoritative KG projection
 * (`GET /api/v1/cidoc/kg/graph/`) — the same endpoint the Heritage Museum
 * uses. Nodes carry real rdf:type IRIs, coordinates (WKT + ORM enrichment),
 * narrative comments, and media; edges are real triples with per-edge
 * PROV-O provenance for assertion-backed relationships. No client-side name
 * matching, NLP "mentions", or synthetic assertions.
 */
import type {
  Agent,
  AtlasCoordProvenance,
  AtlasEntity,
  AtlasEra,
  AtlasEvent,
  DataSource,
  HeritageAssertion,
  OntologyClass,
  OntologyEdge,
  ReliabilityTier,
} from '@/types/atlas';

import type { AtlasLocationCatalogStats } from '@/lib/atlas-api-hydrate';
import { coordsFromKnownPlace } from '@/lib/atlas-place-coords';
import { parseCoord, propagateCoordsAlongLocationEdges, type GeoCoord } from '@/lib/kg-geo';
import type { KgEdgeProvenance, KgGraphEdge, KgGraphNode, KgGraphResponse } from '@/lib/kg-graph';
import { rdfTypeToNodeType } from '@/lib/kg-graph';
import type { NodeType } from '@/lib/ontology/__generated__/heritage-viz-config';

/** Resource IRI segment (registry class key) → knowledge route domain. */
const SEGMENT_TO_KNOWLEDGE_DOMAIN: Readonly<Record<string, string>> = {
  culturalentity: 'entity',
};

/** Registry segments that have a knowledge-base list/detail page. */
const KNOWLEDGE_SEGMENTS = new Set([
  'person',
  'location',
  'event',
  'period',
  'tradition',
  'source',
  'deity',
  'guthi',
  'structure',
  'ritual',
  'festival',
  'iconography',
  'monument',
  'entity',
]);

/** Resource IRI segment → Atlas ontology class (mirrors the demo corpus classes). */
const SEGMENT_TO_CLASS: Readonly<Record<string, OntologyClass>> = {
  structure: 'Temple',
  monument: 'ArchitecturalElement',
  deity: 'Deity',
  person: 'Person',
  location: 'ArchitecturalElement',
  event: 'HistoricalEvent',
  ritual: 'RitualEvent',
  festival: 'Festival',
  guthi: 'Guthi',
  iconography: 'Murti',
  period: 'HistoricalEvent',
  tradition: 'HistoricalEvent',
  source: 'HistoricalEvent',
  caste_group: 'CasteGroup',
  kumari_tenure: 'LivingGoddessTenure',
};

/** rdf:type-derived NodeType → Atlas ontology class (fallback when IRI has no segment). */
const NODE_TYPE_TO_CLASS: Readonly<Record<NodeType, OntologyClass>> = {
  Place: 'ArchitecturalElement',
  Temple: 'Temple',
  BuddhistMonument: 'Stupa',
  ArchitecturalStructure: 'ArchitecturalElement',
  Settlement: 'ArchitecturalElement',
  Deity: 'Deity',
  Festival: 'Festival',
  TimeSpan: 'HistoricalEvent',
  ReligiousTradition: 'HistoricalEvent',
  SacredSite: 'Temple',
  Person: 'Person',
  Guthi: 'Guthi',
  IconographicObject: 'Murti',
  HistoricalPeriod: 'HistoricalEvent',
  Source: 'HistoricalEvent',
  HistoricalEvent: 'HistoricalEvent',
  RitualEvent: 'RitualEvent',
  CasteGroup: 'CasteGroup',
  LivingGoddessTenure: 'LivingGoddessTenure',
  SyncreticRelationship: 'HistoricalEvent',
  HumanMadeObject: 'Murti',
  Group: 'Guthi',
  Set: 'HistoricalEvent',
};

/** NodeType → CIDOC list category used by Atlas filters / place catalog. */
const NODE_TYPE_TO_CATEGORY: Readonly<Partial<Record<NodeType, string>>> = {
  Place: 'location',
  Settlement: 'location',
  Temple: 'structure',
  BuddhistMonument: 'monument',
  ArchitecturalStructure: 'structure',
  SacredSite: 'structure',
  Deity: 'deity',
  Festival: 'festival',
  Person: 'person',
  Guthi: 'guthi',
  IconographicObject: 'iconography',
  HistoricalPeriod: 'period',
  Source: 'source',
  HistoricalEvent: 'event',
  RitualEvent: 'ritual',
  ReligiousTradition: 'tradition',
};

const RESOURCE_IRI_RE = /\/resource\/([^/]+)\/([^/?#]+)\/?$/;

export interface ParsedResourceIri {
  segment: string;
  recordId: string;
}

/** Parse curated resource IRI (`…/resource/<segment>/<pk>`) into route parts. */
export function parseResourceIri(iri: string): ParsedResourceIri | null {
  const m = RESOURCE_IRI_RE.exec(iri);
  if (!m) return null;
  return { segment: m[1].toLowerCase(), recordId: decodeURIComponent(m[2]) };
}

function inferEra(year?: number): AtlasEra {
  if (year == null || !Number.isFinite(year)) return 'modern';
  if (year < 500) return 'ancient';
  if (year < 1500) return 'medieval';
  if (year < 1850) return 'early_modern';
  return 'modern';
}

/** First plausible year in an EDTF-ish / free-text temporal hint. */
export function yearFromTemporalHint(text: string | null | undefined): number | undefined {
  if (!text) return undefined;
  const m = /-?\d{3,4}/.exec(text);
  if (!m) return undefined;
  const year = Number.parseInt(m[0], 10);
  if (!Number.isFinite(year) || Math.abs(year) > 3000) return undefined;
  return year;
}

function confidenceToScore(prov: KgEdgeProvenance): number {
  if (prov.confidenceScore != null && Number.isFinite(prov.confidenceScore)) {
    return Math.min(1, Math.max(0, prov.confidenceScore));
  }
  const text = (prov.confidence ?? '').trim().toLowerCase();
  if (text === 'high' || text === 'verified') return 0.9;
  if (text === 'medium' || text === 'moderate') return 0.7;
  if (text === 'low' || text === 'uncertain') return 0.45;
  // Accepted assertions without an explicit score: solid but not gold-standard.
  return 0.75;
}

function tierFromConfidence(score: number): ReliabilityTier {
  if (score >= 0.85) return 'A';
  if (score >= 0.7) return 'B';
  if (score >= 0.5) return 'C';
  return 'D';
}

function slugId(prefix: string, name: string): string {
  return `${prefix}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`;
}

export interface AtlasKgHydratedCorpus {
  entities: AtlasEntity[];
  edges: OntologyEdge[];
  sources: DataSource[];
  agents: Agent[];
  spatialCount: number;
  locationStats: AtlasLocationCatalogStats;
}

function nodeToEntity(node: KgGraphNode): AtlasEntity {
  const parsed = parseResourceIri(node.id);
  const nodeType = rdfTypeToNodeType(node.types);

  const cls: OntologyClass =
    (parsed ? SEGMENT_TO_CLASS[parsed.segment] : undefined) ??
    (nodeType ? NODE_TYPE_TO_CLASS[nodeType] : undefined) ??
    'ArchitecturalElement';

  const recordCategory =
    parsed?.segment && SEGMENT_TO_CLASS[parsed.segment] != null
      ? parsed.segment
      : nodeType
        ? NODE_TYPE_TO_CATEGORY[nodeType]
        : undefined;

  const foundedYear = yearFromTemporalHint(node.inceptionYear);
  const lat = parseCoord(node.lat);
  const lon = parseCoord(node.long);
  const hasCoords = lat != null && lon != null;

  const events: AtlasEvent[] = [];
  if (foundedYear != null) {
    events.push({
      year: foundedYear,
      kind: 'documented',
      description: node.inceptionYear?.trim()
        ? `Temporal anchor: ${node.inceptionYear.trim()}.`
        : 'Documented in the knowledge graph.',
    });
  }

  const isLux = node.sourceLayer === 'lux';
  const knowledgeDomain =
    parsed && !isLux
      ? (SEGMENT_TO_KNOWLEDGE_DOMAIN[parsed.segment] ?? parsed.segment)
      : undefined;

  return {
    id: node.id,
    name: node.label,
    class: cls,
    era: inferEra(foundedYear),
    summary:
      node.comment?.trim() ||
      (isLux
        ? 'Linked Yale LUX collection record — open the external catalogue for details.'
        : `${node.label} — reviewed entity in the HeritageGraph public knowledge graph.`),
    assertions: [],
    foundedYear,
    lastKnownExistenceYear: null,
    events,
    relatedEntityIds: [],
    lat: hasCoords ? lat : undefined,
    lon: hasCoords ? lon : undefined,
    height: hasCoords ? 120 : undefined,
    coordProvenance: hasCoords ? 'verified' : 'unmapped',
    recordCategory,
    knowledgeDomain:
      knowledgeDomain && KNOWLEDGE_SEGMENTS.has(knowledgeDomain) ? knowledgeDomain : undefined,
    cidocRecordId: parsed && !isLux ? parsed.recordId : undefined,
    imageUrl: node.imageUrl ?? undefined,
    images: node.images?.length ? node.images : undefined,
    imageCredits: node.imageCredits ?? undefined,
    sourceLayer: node.sourceLayer ?? 'curated',
    externalUri: node.externalUri ?? undefined,
  };
}

interface ProvenanceRegistry {
  sources: Map<string, DataSource>;
  agents: Map<string, Agent>;
}

function assertionFromEdge(
  edge: KgGraphEdge,
  index: number,
  targetLabel: string,
  registry: ProvenanceRegistry,
): HeritageAssertion {
  const prov = edge.provenance as KgEdgeProvenance;
  const score = confidenceToScore(prov);

  let sourceId: string | null = null;
  if (prov.source?.trim()) {
    const name = prov.source.trim();
    sourceId = slugId('kg-src', name);
    if (!registry.sources.has(sourceId)) {
      registry.sources.set(sourceId, {
        id: sourceId,
        name,
        sourceType: 'citation',
        reliabilityTier: tierFromConfidence(score),
        citation: name,
      });
    }
  }

  let agentId = 'agent-system';
  if (prov.assertedBy?.trim()) {
    const name = prov.assertedBy.trim();
    agentId = slugId('kg-agent', name);
    if (!registry.agents.has(agentId)) {
      registry.agents.set(agentId, { id: agentId, name, role: 'researcher' });
    }
  }

  return {
    id: `kg-assert-${index}`,
    assertedProperty: edge.predicateLocal || edge.predicateLabel || edge.predicate,
    assertedValue: `${edge.predicateLabel || edge.predicateLocal} → ${targetLabel}${
      prov.temporalScope?.trim() ? ` (${prov.temporalScope.trim()})` : ''
    }`,
    attributedToAgentId: agentId,
    derivedFromSourceIds: sourceId ? [sourceId] : [],
    generatedAtTime: prov.assertedAt ?? '',
    confidenceScore: score,
    reconciliationStatus: 'confirmed',
  };
}

function computeLocationStats(entities: AtlasEntity[]): AtlasLocationCatalogStats {
  const places = entities.filter((e) => e.recordCategory === 'location');
  const mapped = places.filter((e) => e.lat != null && e.lon != null);
  return {
    totalPlaces: places.length,
    mappedOnGlobe: mapped.length,
    unmapped: places.length - mapped.length,
    verified: places.filter((e) => e.coordProvenance === 'verified').length,
    gazetteer: places.filter((e) => e.coordProvenance === 'gazetteer').length,
    inherited: places.filter((e) => e.coordProvenance === 'inherited').length,
  };
}

/** Convert the `/cidoc/kg/graph/` projection into the Atlas store corpus. */
export function hydrateAtlasFromKgGraph(resp: KgGraphResponse): AtlasKgHydratedCorpus {
  const entities = resp.nodes.map(nodeToEntity);
  const byId = new Map(entities.map((e) => [e.id, e]));
  const labelById = new Map(resp.nodes.map((n) => [n.id, n.label]));

  const registry: ProvenanceRegistry = { sources: new Map(), agents: new Map() };
  const edges: OntologyEdge[] = [];
  let assertionIndex = 0;

  for (const edge of resp.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    const predicate = edge.predicateLocal || edge.predicateLabel || edge.predicate;
    edges.push({
      id: `kg-edge-${edges.length}`,
      source: edge.source,
      target: edge.target,
      predicate,
      hasProvenance: edge.provenance != null,
    });

    const subject = byId.get(edge.source);
    if (subject) {
      if (!subject.relatedEntityIds.includes(edge.target)) {
        subject.relatedEntityIds.push(edge.target);
      }
      if (edge.provenance) {
        subject.assertions.push(
          assertionFromEdge(
            edge,
            assertionIndex++,
            labelById.get(edge.target) ?? edge.target,
            registry,
          ),
        );
      }
    }
    const object = byId.get(edge.target);
    if (object && !object.relatedEntityIds.includes(edge.source)) {
      object.relatedEntityIds.push(edge.source);
    }
  }

  // Coord tiers: verified (API) → inherited (location-edge propagation) → gazetteer → unmapped.
  const coordById = new Map<string, GeoCoord>();
  for (const e of entities) {
    if (e.lat != null && e.lon != null) coordById.set(e.id, { lat: e.lat, lon: e.lon });
  }
  const inherited = propagateCoordsAlongLocationEdges(
    coordById,
    edges.map((e) => ({ source: e.source, target: e.target, predicate: e.predicate })),
  );
  for (const [id, coords] of inherited) {
    const e = byId.get(id);
    if (e && (e.lat == null || e.lon == null)) {
      e.lat = coords.lat;
      e.lon = coords.lon;
      e.height = e.height ?? 120;
      e.coordProvenance = 'inherited';
    }
  }
  for (const e of entities) {
    if (e.lat != null && e.lon != null) continue;
    const fallback = coordsFromKnownPlace(e.name);
    if (fallback.lat != null && fallback.lon != null) {
      e.lat = fallback.lat;
      e.lon = fallback.lon;
      e.height = 120;
      e.coordProvenance = 'gazetteer' satisfies AtlasCoordProvenance;
    } else {
      e.coordProvenance = 'unmapped';
    }
  }

  const spatialCount = entities.filter((e) => e.lat != null && e.lon != null).length;
  return {
    entities,
    edges,
    sources: [...registry.sources.values()],
    agents: [...registry.agents.values()],
    spatialCount,
    locationStats: computeLocationStats(entities),
  };
}
