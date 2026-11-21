/**
 * Short attributed descriptions for the UNESCO cultural subjects.
 *
 * Produced by `scripts/freeze-unesco-descriptions.mjs` from Wikipedia lead
 * sections. Quoted, not paraphrased, and always shown with its author, licence
 * and retrieval date — the opposite of the demo corpus's prose, which has no
 * recorded source at all.
 *
 * `sentencesRemoved` is carried through to the UI on purpose. The source leads
 * describe the Durbar Squares as World Heritage Sites in the plural; those
 * sentences are dropped because the page states the real relationship using
 * UNESCO's own component numbering. Trimming a quotation is defensible only if
 * a reader can see that it happened.
 */
import manifest from '@/data/unesco-descriptions.json';

export interface SubjectDescription {
  readonly text: string;
  readonly sentencesRemoved: number;
  readonly source: string;
  readonly sourceTitle: string;
  readonly sourceUrl: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly retrieved: string;
}

interface DescriptionsManifest {
  _provenance: Record<string, string>;
  subjects: Record<string, SubjectDescription | null>;
}

const DOC = manifest as unknown as DescriptionsManifest;

export const DESCRIPTIONS_PROVENANCE = DOC._provenance;

export function descriptionFor(subjectKey: string): SubjectDescription | null {
  return DOC.subjects[subjectKey] ?? null;
}
