/**
 * Maps live CIDOC instance graph payloads into Heritage Atlas corpus types.
 * Assertions are synthesized when the API does not yet expose PROV-O rows.
 */
import type {
  AtlasCoordProvenance,
  AtlasEntity,
  AtlasEra,
  AtlasEvent,
  HeritageAssertion,
  OntologyClass,
  OntologyEdge,
} from '@/types/atlas';

import { parseLiveNodeId } from '@/lib/atlas-entity-links';
import { resolveCoordsWithProvenance } from '@/lib/atlas-place-coords';

import type { InstanceCategory, InstanceGraphData, InstanceNode } from './instance-graph';

const CATEGORY_TO_CLASS: Record<InstanceCategory, OntologyClass> = {
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
};

const LOCATION_EDGE_LABELS = new Set([
  'located_at',
  'has_current_location',
  'co_located',
]);

function inferEra(year?: number): AtlasEra {
  if (year == null || !Number.isFinite(year)) return 'modern';
  if (year < 500) return 'ancient';
  if (year < 1500) return 'medieval';
  if (year < 1850) return 'early_modern';
  return 'modern';
}

function readYear(raw: Record<string, unknown>): number | undefined {
  for (const key of ['begin_of_existence', 'start_date', 'year', 'founded_year']) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
    if (typeof v === 'string' && /^\d{3,4}/.test(v)) return Number.parseInt(v.slice(0, 4), 10);
  }
  return undefined;
}

function syntheticAssertion(entityId: string, label: string): HeritageAssertion {
  return {
    id: `live-${entityId}-existence`,
    assertedProperty: 'catalogued_in',
    assertedValue: label,
    attributedToAgentId: 'agent-system',
    derivedFromSourceIds: [],
    generatedAtTime: new Date().toISOString(),
    confidenceScore: 0.55,
    reconciliationStatus: 'unverified',
  };
}

function nodeToEntity(node: InstanceNode): AtlasEntity {
  const raw = node.rawData;
  const foundedYear = readYear(raw);
  const resolved = resolveCoordsWithProvenance(raw, node.label);
  const cls = CATEGORY_TO_CLASS[node.category] ?? 'ArchitecturalElement';

  const events: AtlasEvent[] = [];
  const endYear = readYear({ end_of_existence: raw.end_of_existence, end_date: raw.end_date });
  if (foundedYear != null) {
    events.push({
      year: foundedYear,
      kind: 'documented',
      description: `Catalogued via ${node.entityType}.`,
    });
  }

  const link = parseLiveNodeId(node.id);
  const locationType =
    node.category === 'location' && raw.type != null ? String(raw.type) : undefined;

  return {
    id: node.id,
    name: node.label,
    class: cls,
    era: inferEra(foundedYear),
    summary: node.description || `${node.entityType} from HeritageGraph API.`,
    assertions: [syntheticAssertion(node.id, node.entityType)],
    foundedYear,
    lastKnownExistenceYear: endYear ?? null,
    events,
    relatedEntityIds: [],
    lat: resolved.lat,
    lon: resolved.lon,
    height: resolved.lat != null ? 120 : undefined,
    coordProvenance: resolved.provenance,
    recordCategory: node.category,
    locationType,
    knowledgeDomain: link?.domain,
    cidocRecordId: link?.recordId,
  };
}

/** Copy coordinates along location edges; mark targets as inherited. */
function propagateLocationCoords(entities: AtlasEntity[], edges: OntologyEdge[]): void {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const coordById = new Map<string, { lat: number; lon: number; provenance: AtlasCoordProvenance }>();

  for (const e of entities) {
    if (e.lat != null && e.lon != null && e.coordProvenance && e.coordProvenance !== 'unmapped') {
      coordById.set(e.id, { lat: e.lat, lon: e.lon, provenance: e.coordProvenance });
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (!LOCATION_EDGE_LABELS.has(edge.predicate)) continue;
      const src = coordById.get(edge.source);
      const tgt = coordById.get(edge.target);
      if (src && !tgt) {
        coordById.set(edge.target, src);
        const ent = byId.get(edge.target);
        if (ent && (ent.lat == null || ent.lon == null)) {
          ent.lat = src.lat;
          ent.lon = src.lon;
          ent.height = ent.height ?? 120;
          ent.coordProvenance = 'inherited';
          changed = true;
        }
      } else if (tgt && !src) {
        coordById.set(edge.source, tgt);
        const ent = byId.get(edge.source);
        if (ent && (ent.lat == null || ent.lon == null)) {
          ent.lat = tgt.lat;
          ent.lon = tgt.lon;
          ent.height = ent.height ?? 120;
          ent.coordProvenance = 'inherited';
          changed = true;
        }
      }
    }
  }

  for (const e of entities) {
    if (e.lat == null || e.lon == null) {
      e.coordProvenance = 'unmapped';
    }
  }
}

export interface AtlasLocationCatalogStats {
  totalPlaces: number;
  mappedOnGlobe: number;
  unmapped: number;
  verified: number;
  gazetteer: number;
  inherited: number;
}

export interface AtlasHydratedCorpus {
  entities: AtlasEntity[];
  edges: OntologyEdge[];
  spatialCount: number;
  locationStats: AtlasLocationCatalogStats;
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

/** Convert `fetchInstanceGraphData` output into Atlas store seed. */
export function hydrateAtlasFromInstanceGraph(data: InstanceGraphData): AtlasHydratedCorpus {
  const entities = data.nodes.map(nodeToEntity);
  const edges: OntologyEdge[] = data.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    predicate: e.label,
  }));

  propagateLocationCoords(entities, edges);

  const spatialCount = entities.filter((e) => e.lat != null && e.lon != null).length;
  return {
    entities,
    edges,
    spatialCount,
    locationStats: computeLocationStats(entities),
  };
}
