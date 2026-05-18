/**
 * Maps live CIDOC instance graph payloads into Heritage Atlas corpus types.
 * Assertions are synthesized when the API does not yet expose PROV-O rows.
 */
import type {
  AtlasEntity,
  AtlasEra,
  AtlasEvent,
  HeritageAssertion,
  OntologyClass,
  OntologyEdge,
} from '@/types/atlas';

import { parseLiveNodeId } from '@/lib/atlas-entity-links';

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

function inferEra(year?: number): AtlasEra {
  if (year == null || !Number.isFinite(year)) return 'modern';
  if (year < 500) return 'ancient';
  if (year < 1500) return 'medieval';
  if (year < 1850) return 'early_modern';
  return 'modern';
}

function readCoord(raw: Record<string, unknown>, key: 'latitude' | 'longitude'): number | undefined {
  const v = raw[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function extractCoords(raw: Record<string, unknown>): { lat?: number; lon?: number } {
  const lat = readCoord(raw, 'latitude');
  const lon = readCoord(raw, 'longitude');
  if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { lat, lon };
  }
  return {};
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
  const { lat, lon } = extractCoords(raw);
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
    lat,
    lon,
    height: lat != null ? 120 : undefined,
    knowledgeDomain: link?.domain,
    cidocRecordId: link?.recordId,
  };
}

export interface AtlasHydratedCorpus {
  entities: AtlasEntity[];
  edges: OntologyEdge[];
  spatialCount: number;
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

  const spatialCount = entities.filter((e) => e.lat != null && e.lon != null).length;
  return { entities, edges, spatialCount };
}
