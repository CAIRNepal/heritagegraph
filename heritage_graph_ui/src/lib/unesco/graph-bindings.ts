/**
 * Navigation bindings from a UNESCO subject to a record elsewhere in the app.
 *
 * These are NAVIGATION AIDS, not identity claims. A binding says "this record
 * is about the same subject, open it there" — it asserts nothing new about the
 * monument and adds no facts.
 *
 * Deliberately incomplete. A subject is bound only where an existing record is
 * genuinely the same thing:
 *
 *  - `bhaktapur-durbar-square` is NOT bound to the corpus's `BhaktapurCity`.
 *    That node is the settlement which *contains* the monument zone; treating
 *    them as one is the same category error that makes the corpus label
 *    Nyatapola Temple a World Heritage Site.
 *  - `hanuman-dhoka` has no binding because the demo corpus has no node for it
 *    at all, and its two reviewed-graph records are bare label-and-type stubs.
 *
 * Unbound subjects still link onward — to the museum, atlas or knowledge base
 * without a preselected node — so no entry point dead-ends.
 */

/** Node ids in the frozen demo corpus (`src/data/heritage-demo.json`). */
const DEMO_CORPUS_NODE: Readonly<Record<string, string>> = {
  'patan-durbar-square': 'heritage:PatanDurbarSquare',
  swayambhu: 'heritage:SwayambhunathStupa',
  bauddhanath: 'heritage:BoudhanathStupa',
  pashupati: 'heritage:PashupatinathTemple',
  'changu-narayan': 'heritage:ChanguNarayan',
  lumbini: 'heritage:Lumbini',
};

/** Museum URL for a subject; falls back to the museum's own entry state. */
export function museumHref(subjectKey: string): string {
  const node = DEMO_CORPUS_NODE[subjectKey];
  if (!node) return '/heritage-museum';
  return `/heritage-museum?source=demo&node=${encodeURIComponent(node)}`;
}

/** Atlas URL for a subject; falls back to the atlas entry state. */
export function atlasHref(subjectKey: string): string {
  const node = DEMO_CORPUS_NODE[subjectKey];
  if (!node) return '/atlas';
  return `/atlas?source=demo&selected=${encodeURIComponent(node)}`;
}

/** True when the subject resolves to a specific record rather than a surface. */
export function hasRecordBinding(subjectKey: string): boolean {
  return Boolean(DEMO_CORPUS_NODE[subjectKey]);
}

/** Knowledge-base browse route for places. */
export const KNOWLEDGE_PLACES_HREF = '/knowledge/location';
