/**
 * Sourced structured facts for the UNESCO cultural subjects.
 *
 * Produced by `scripts/freeze-unesco-facts.mjs` from Wikidata claims. Unlike
 * the demo corpus's prose — which its own provenance block marks unsourced and
 * uncitable — every value here traces to a named Wikidata property on a named
 * item, so a reader can re-check it. That is the whole point: it lets a record
 * say something substantive without anyone having to write prose about it.
 *
 * The Wikidata *label* for a subject is deliberately not used as a title. Our
 * canonical names come from `ground-truth.ts`; Wikidata calls Hanuman Dhoka
 * "Basantapur Durbar Square", which is a valid alias but not what UNESCO calls
 * the zone.
 */
import manifest from '@/data/unesco-facts.json';

/** A Wikidata property id, kept so a displayed fact can be traced back. */
export type WikidataProperty = string;

export interface SourcedFact {
  readonly values: readonly string[];
  readonly property: WikidataProperty;
}

export interface SubjectFacts {
  readonly wikidataId: string;
  readonly wikidataUrl: string;
  readonly label: string | null;
  readonly facts: Readonly<Record<string, SourcedFact>>;
}

interface FactsManifest {
  _provenance: { generatedBy: string; retrieved: string; source: string; note: string };
  subjects: Record<string, SubjectFacts>;
}

const DOC = manifest as unknown as FactsManifest;

export const FACTS_PROVENANCE = DOC._provenance;

/**
 * Display order. `worldHeritageId` leads because it is the one fact that
 * settles the framing this platform has to get right: a Kathmandu Valley zone
 * carries `121bis-00N`, a component reference, not a property of its own.
 */
export const FACT_ORDER = [
  'worldHeritageId',
  'instanceOf',
  'inception',
  'partOf',
  'locatedIn',
  'country',
  'area',
  'architecturalStyle',
  'architect',
] as const;

export type FactKey = (typeof FACT_ORDER)[number];

export function factsFor(subjectKey: string): SubjectFacts | null {
  return DOC.subjects[subjectKey] ?? null;
}

/** Facts for a subject, in display order, skipping anything not recorded. */
export function orderedFacts(
  subjectKey: string,
): Array<{ key: FactKey; values: readonly string[]; property: WikidataProperty }> {
  const s = factsFor(subjectKey);
  if (!s) return [];
  return FACT_ORDER.flatMap((key) => {
    const f = s.facts[key];
    return f ? [{ key, values: f.values, property: f.property }] : [];
  });
}

/** The official UNESCO World Heritage reference, when one is recorded. */
export function worldHeritageRef(subjectKey: string): string | null {
  return factsFor(subjectKey)?.facts.worldHeritageId?.values[0] ?? null;
}

/**
 * Map a demo-corpus node id to a UNESCO subject key, so the museum can show
 * sourced facts for a record the reader opened from the entry page.
 *
 * Kept beside the corpus ids rather than in the corpus itself: this is a
 * navigational join, not a claim added to the dataset.
 */
const CORPUS_NODE_TO_SUBJECT: Readonly<Record<string, string>> = {
  'heritage:HanumanDhokaDurbarSquare': 'hanuman-dhoka',
  'heritage:PatanDurbarSquare': 'patan-durbar-square',
  'heritage:BhaktapurDurbarSquare': 'bhaktapur-durbar-square',
  'heritage:SwayambhunathStupa': 'swayambhu',
  'heritage:BoudhanathStupa': 'bauddhanath',
  'heritage:PashupatinathTemple': 'pashupati',
  'heritage:ChanguNarayan': 'changu-narayan',
  'heritage:Lumbini': 'lumbini',
  'heritage:KathmanduValley': 'kathmandu-valley',
};

export function subjectKeyForNodeId(nodeId: string | null | undefined): string | null {
  if (!nodeId) return null;
  return CORPUS_NODE_TO_SUBJECT[nodeId] ?? null;
}
