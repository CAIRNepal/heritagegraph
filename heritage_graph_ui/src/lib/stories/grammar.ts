/**
 * The narrative grammar of the knowledge graph.
 *
 * A story is a walk along typed edges, and every edge type raises a question:
 * a festival's `took_place_at` asks "Where does it happen?", a temple's
 * `dedicated_to` asks "Who is it for?". This table is that mapping, keyed by
 * the predicate's local name as the graph API returns it. Reading an edge
 * backwards (a place seen from the temples that stand in it) raises a
 * different question, so each entry has both directions.
 *
 * Edges absent here are not turned into stops. `instance_of` says what a record
 * is, not what it connects to, and `cites` belongs in the sources, not the plot.
 *
 * Nepali questions are only filled where a reviewed translation exists; the UI
 * shows the English line alone otherwise rather than an unchecked rendering.
 */

export type ThemeKind = 'belief' | 'place' | 'time' | 'people' | 'part' | 'tie';

export interface Question {
  en: string;
  ne?: string;
}

export interface Relation {
  /** How the edge reads from its subject: "Nyatapola Temple — stands in → Bhaktapur". */
  phrase: string;
  /** How it reads from its object, for inbound edges: "Bhaktapur — is home to → …". */
  inversePhrase: string;
  /** Question raised by following the edge forwards. */
  out: Question;
  /** Question raised by following it backwards. */
  in: Question;
  /** `out`, worded for a person: "When did they live?", not "When was it active?". */
  outPerson?: Question;
  kind: ThemeKind;
  /** Lower comes first in a story. */
  order: number;
}

const where = (phrase: string, inversePhrase: string): Relation => ({
  phrase,
  inversePhrase,
  out: { en: 'Where does it stand?' },
  in: { en: 'What stands here?' },
  kind: 'place',
  order: 2,
});

const happens = (phrase: string, inversePhrase: string): Relation => ({
  phrase,
  inversePhrase,
  out: { en: 'Where does it happen?' },
  in: { en: 'What happens here?' },
  kind: 'place',
  order: 2,
});

export const RELATIONS: Record<string, Relation> = {
  dedicated_to: {
    phrase: 'is dedicated to',
    inversePhrase: 'is worshipped at',
    out: { en: 'Who is it for?' },
    in: { en: 'Where is it worshipped?' },
    kind: 'belief',
    order: 1,
  },
  honors: {
    phrase: 'honours',
    inversePhrase: 'is honoured by',
    out: { en: 'Who does it honour?' },
    in: { en: 'Who honours it?' },
    kind: 'belief',
    order: 1,
  },
  invokesDeity: {
    phrase: 'invokes',
    inversePhrase: 'is invoked by',
    out: { en: 'Which god does it call on?' },
    in: { en: 'Which rites call on it?' },
    kind: 'belief',
    order: 1,
  },
  P55_has_current_location: where('stands in', 'is home to'),
  located_at: where('is located at', 'is home to'),
  housed_in: where('is housed in', 'houses'),
  based_in: where('is based in', 'is the base of'),
  located_in: {
    phrase: 'lies within',
    inversePhrase: 'contains',
    out: { en: 'Where does it lie?' },
    in: { en: 'What lies within it?' },
    kind: 'place',
    order: 2,
  },
  P7_took_place_at: happens('takes place at', 'is the stage for'),
  held_at: happens('is held at', 'is the stage for'),
  celebrated_at: happens('is celebrated at', 'is the stage for'),
  performed_at: happens('is performed at', 'is the stage for'),
  hasReligiousTradition: {
    phrase: 'belongs to',
    inversePhrase: 'is the tradition of',
    out: { en: 'Which tradition keeps it?' },
    in: { en: 'What belongs to this tradition?' },
    kind: 'belief',
    order: 3,
  },
  embodies: {
    phrase: 'embodies',
    inversePhrase: 'is embodied in',
    out: { en: 'What does it embody?' },
    in: { en: 'What embodies it?' },
    kind: 'belief',
    order: 3,
  },
  depicts: {
    phrase: 'depicts',
    inversePhrase: 'is depicted in',
    out: { en: 'What does it show?' },
    in: { en: 'Where is it shown?' },
    kind: 'belief',
    order: 3,
  },
  active_during: {
    phrase: 'was active during',
    inversePhrase: 'was the time of',
    out: { en: 'When was it active?' },
    outPerson: { en: 'When did they live?' },
    in: { en: 'What was active then?' },
    kind: 'time',
    order: 4,
  },
  // Says what the edge says: a community observes the practice. "Keeps it
  // alive" read continuity into it that the data does not record.
  observed_by: {
    phrase: 'is observed by',
    inversePhrase: 'observes',
    out: { en: 'Who observes it?' },
    in: { en: 'What do they observe?' },
    kind: 'people',
    order: 5,
  },
  member_of: {
    phrase: 'is a member of',
    // Read from the group: "Newar — has as a member → …", not the reverse.
    inversePhrase: 'has as a member',
    out: { en: 'Who does it belong with?' },
    outPerson: { en: 'Who did they belong with?' },
    in: { en: 'Who belongs to it?' },
    kind: 'people',
    order: 5,
  },
  belongs_to_caste: {
    phrase: 'belongs to',
    inversePhrase: 'is the community of',
    out: { en: 'Which community is it part of?' },
    outPerson: { en: 'Which community did they come from?' },
    in: { en: 'Who belongs to this community?' },
    kind: 'people',
    order: 5,
  },
  commissioned_by: {
    phrase: 'was commissioned by',
    inversePhrase: 'commissioned',
    // Commissioning is not building: a commission may be an image or a text.
    out: { en: 'Who commissioned it?' },
    in: { en: 'What did they commission?' },
    kind: 'people',
    order: 5,
  },
  P9i_forms_part_of: {
    phrase: 'is part of',
    inversePhrase: 'includes',
    out: { en: 'What is it part of?' },
    in: { en: 'What happens within it?' },
    kind: 'part',
    order: 6,
  },
  is_component_of: {
    phrase: 'is part of',
    inversePhrase: 'includes',
    out: { en: 'What is it part of?' },
    in: { en: 'What is part of it?' },
    kind: 'part',
    order: 6,
  },
  P46i_forms_part_of: {
    phrase: 'is part of',
    inversePhrase: 'includes',
    out: { en: 'What is it part of?' },
    in: { en: 'What is part of it?' },
    kind: 'part',
    order: 6,
  },
  associated_with: {
    phrase: 'is associated with',
    inversePhrase: 'is associated with',
    out: { en: 'What else is it tied to?' },
    outPerson: { en: 'What else are they tied to?' },
    in: { en: 'What else is it tied to?' },
    kind: 'tie',
    order: 9,
  },
};

/** Edges that describe the record itself rather than connect it to the story. */
export const NON_NARRATIVE = new Set(['instance_of', 'cites']);

export function relationFor(predicateLocal: string): Relation | null {
  return RELATIONS[predicateLocal] ?? null;
}

/** Fallback phrase for an edge outside the grammar, from its local name. */
export function humanizePredicate(predicateLocal: string): string {
  return predicateLocal
    .replace(/^P\d+[a-z]?_/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase();
}
