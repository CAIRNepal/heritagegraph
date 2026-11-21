/**
 * What a reader may rely on a record for, from where its content came.
 *
 * "Community reviewed" used to be shown for every record of the live graph.
 * Since the authority import, most live records come from Wikidata and no
 * person has reviewed them; saying otherwise would overstate the evidence.
 */

import type { KgRecordSource } from '@/lib/kg-graph';

export type ProvenanceTier = 'imported' | 'reviewed' | 'curated' | 'inReview';

/** Contributors that are import pipelines, not people. */
const IMPORTERS = new Set(['wikidata_import', 'danam_import']);

export function provenanceTier(src: KgRecordSource | null | undefined): ProvenanceTier | null {
  if (!src) return null;
  if (src.contributor && IMPORTERS.has(src.contributor)) return 'imported';
  if (src.status === 'pending_review' || src.status === 'pending_revision') return 'inReview';
  if (src.contributor && (src.status === 'accepted' || src.status === 'merged')) return 'reviewed';
  return 'curated';
}

/** "Wikidata Q301339" from a citation, for a link to the item. */
export function wikidataIdIn(citation: string | null | undefined): string | null {
  return citation?.match(/Wikidata (Q\d+)/)?.[1] ?? null;
}
