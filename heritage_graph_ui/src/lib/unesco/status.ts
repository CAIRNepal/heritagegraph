/**
 * Correct UNESCO status for a record, derived from ground truth.
 *
 * WHY NOT JUST RENDER `node.unescoStatus`?
 *
 * Because that field is wrong. The frozen demo corpus stamps
 * `"World Heritage Site (1979)"` onto seven separate nodes, and two of them are
 * not monument zones at all:
 *
 *   - "Nyatapola Temple" is a structure *inside* the Bhaktapur Durbar Square
 *     monument zone.
 *   - "Bhaktapur" is the city; the inscribed zone is Bhaktapur Durbar Square.
 *
 * It also frames the genuine zones as individual World Heritage Sites, which
 * they are not — they are monument zones of one serial property. The reviewed
 * graph repeats the same error inside free-text `rdfs:comment` literals.
 *
 * So every surface that wants to show UNESCO status resolves it through here
 * instead. A record that is not a monument zone or a property gets `null`, and
 * the caller renders nothing. Saying nothing is always available; saying
 * something wrong is not.
 */
import { KATHMANDU_VALLEY, LUMBINI, zoneForLabel } from './ground-truth';

export type UnescoStatement =
  | { kind: 'monumentZone'; year: number; zoneKey: string }
  | { kind: 'property'; year: number; propertyKey: string };

/**
 * Resolve a record's label to a defensible UNESCO statement, or `null`.
 *
 * Matching is by label against the ground-truth canonical names and their
 * recorded aliases, which is how the fragmented graph records (Bauddhanath
 * appears under three separate IRIs) resolve to one zone.
 */
export function unescoStatementForLabel(
  label: string | null | undefined,
): UnescoStatement | null {
  const zone = zoneForLabel(label);
  if (zone) {
    return {
      kind: 'monumentZone',
      year: KATHMANDU_VALLEY.yearInscribed,
      zoneKey: zone.key,
    };
  }

  const name = label?.trim().toLowerCase() ?? '';
  if (!name) return null;

  // The Valley itself, by its own name.
  if (name === KATHMANDU_VALLEY.name.toLowerCase()) {
    return {
      kind: 'property',
      year: KATHMANDU_VALLEY.yearInscribed,
      propertyKey: KATHMANDU_VALLEY.key,
    };
  }

  // Lumbini. The corpus label carries a descriptive suffix, so match the stem.
  if (name === 'lumbini' || name.startsWith('lumbini')) {
    return { kind: 'property', year: LUMBINI.yearInscribed, propertyKey: LUMBINI.key };
  }

  return null;
}

/** True when a record has a defensible UNESCO status to show. */
export function hasUnescoStatement(label: string | null | undefined): boolean {
  return unescoStatementForLabel(label) !== null;
}
