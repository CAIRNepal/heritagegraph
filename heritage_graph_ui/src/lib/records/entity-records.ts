/**
 * Sourced records for corpus entities, keyed by corpus @id.
 *
 * Produced by `scripts/freeze-entity-records.mjs`. Before this, only the eight
 * UNESCO subjects had anything to read; every other entity showed a photograph,
 * an ontology class and nothing else — and an ontology class is not information
 * to a general reader.
 *
 * 38 of the 46 corpus entities now carry facts and a description. The rest are
 * abstractions with no Wikidata item (a guthi network, a local rediscovery
 * event); they fall back to the explicit "not recorded" states rather than
 * being padded out.
 */
import manifest from '@/data/entity-records.json';

export interface RecordFact {
  readonly values: readonly string[];
  readonly property: string;
}

export interface RecordDescription {
  readonly text: string;
  readonly sentencesRemoved: number;
  readonly sourceTitle: string;
  readonly sourceUrl: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly retrieved: string;
}

export interface EntityRecord {
  readonly label: string;
  readonly wikidataId: string | null;
  readonly wikidataUrl: string | null;
  readonly facts: Readonly<Record<string, RecordFact>>;
  readonly description: RecordDescription | null;
}

interface RecordsManifest {
  _provenance: Record<string, string>;
  entities: Record<string, EntityRecord>;
}

const DOC = manifest as unknown as RecordsManifest;

export const RECORDS_PROVENANCE = DOC._provenance;

/** Reading order. Identity first, then place, then time, then the technical. */
export const FACT_ORDER = [
  'worldHeritageId',
  'instanceOf',
  'heritageDesignation',
  'inception',
  'startTime',
  'endTime',
  'birth',
  'death',
  'occupation',
  'title',
  'citizenship',
  'religion',
  'venerated',
  'partOf',
  'locatedIn',
  'country',
  'period',
  'area',
  'elevation',
  'architecturalStyle',
  'architect',
] as const;

export type RecordFactKey = (typeof FACT_ORDER)[number];

export function recordFor(nodeId: string | null | undefined): EntityRecord | null {
  if (!nodeId) return null;
  return DOC.entities[nodeId] ?? null;
}

/** Facts in display order, skipping whatever is not recorded. */
export function orderedRecordFacts(
  nodeId: string | null | undefined,
): Array<{ key: RecordFactKey; values: readonly string[]; property: string }> {
  const r = recordFor(nodeId);
  if (!r) return [];
  return FACT_ORDER.flatMap((key) => {
    const f = r.facts[key];
    return f ? [{ key, values: f.values, property: f.property }] : [];
  });
}

export function hasRecord(nodeId: string | null | undefined): boolean {
  const r = recordFor(nodeId);
  return Boolean(r && (r.description || Object.keys(r.facts).length));
}
