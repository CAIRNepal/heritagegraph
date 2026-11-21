/**
 * Contributor-facing plain language for ontology form fields.
 *
 * Registry keys stay API-stable; labels/help shown in OntologyForm are remapped
 * here so community contributors never see CRM verb phrases or CRMinf jargon.
 */

import type { OntologyField } from '@/lib/ontology/types';

interface PlainFieldCopy {
  label?: string;
  description?: string;
  help?: string;
  /** Hide from the default contribute form (still in schema for experts / API). */
  hideByDefault?: boolean;
}

/** Registry class key → everyday name shown on hub + form chrome. */
export const CONTRIBUTE_CLASS_PLAIN_LABELS: Readonly<Record<string, string>> = {
  entity: 'Something else',
  structure: 'Building or temple',
  iconography: 'Painting or statue',
  monument: 'Monument',
  deity: 'Deity',
  tradition: 'Tradition',
  location: 'Place',
  period: 'Historical period',
  calendar: 'Calendar system',
  syncretism: 'Shared deity names',
  person: 'Person',
  guthi: 'Guthi',
  caste_group: 'Community group',
  entity_proposal: 'Same thing, two records',
  ritual: 'Ritual',
  festival: 'Festival',
  event: 'Historical event',
  production: 'Making or building',
  consecration: 'Consecration',
  enshrinement: 'Enshrinement',
  transfer_of_custody: 'Change of stewardship',
  kumari_tenure: 'Living Goddess tenure',
  kumari_selection: 'Living Goddess selection',
  kumari_retirement: 'Living Goddess retirement',
  source: 'Book or document',
  data_source: 'Evidence record',
  assertion: 'A claim with evidence',
};

export function plainContributeClassLabel(
  registryKey: string,
  fallback?: string,
): string {
  return CONTRIBUTE_CLASS_PLAIN_LABELS[registryKey] || fallback || registryKey;
}

/** Key → plain copy. Applied in OntologyForm FieldRenderer. */
export const CONTRIBUTE_FIELD_PLAIN_COPY: Readonly<Record<string, PlainFieldCopy>> = {
  was_documented_by: {
    label: 'Source or document',
    description: 'Book, inscription, oral history, or other evidence for this record.',
    help: 'Pick an existing source, or leave blank if you will add one later.',
  },
  documented_in_source: {
    label: 'Mentioned in',
    description: 'Where this was written about or recorded.',
  },
  has_assertion: {
    label: 'Linked claims',
    description: 'Optional expert claims attached to this record.',
    hideByDefault: true,
  },
  asserts_about_entity: {
    label: 'About (place, person, or thing)',
    description: 'What heritage item is this claim about?',
    help: 'Search for an existing record, or create one first.',
  },
  asserts_about_event: {
    label: 'About (event or ritual)',
    description: 'If the claim is about an event, pick it here.',
  },
  was_derived_from_source: {
    label: 'Main source',
    description: 'The evidence that supports this claim.',
    help: 'Every claim should point to at least one source when you can.',
  },
  was_attributed_to_agent: {
    label: 'Who said this?',
    description: 'Author, priest, scholar, or community member behind the claim.',
  },
  asserted_property: {
    label: 'What are you claiming?',
    description: 'Short name for the fact (for example: founding year, patron deity).',
    help: 'Use everyday words. Example: “Founded in” or “Honours the deity”.',
  },
  asserted_value: {
    label: 'Details of the claim',
    description: 'The value or statement you believe is true.',
    help: 'Example: “1647 CE” or “Matsyendranath”.',
  },
  assertion_content: {
    label: 'Full statement (optional)',
    description: 'Write the claim in a full sentence if helpful.',
  },
  confidence_score: {
    label: 'How sure are you?',
    description: 'Your confidence in this claim (0 = unsure, 1 = very sure).',
    help: 'If you are not sure, use a lower number. Reviewers will see this.',
  },
  justification_note: {
    label: 'Why do you believe this?',
    description: 'A short note for reviewers — how you know, or who told you.',
  },
  crminf_conclusion: {
    label: 'Expert conclusion note',
    description: 'Optional technical conclusion for specialists.',
    hideByDefault: true,
  },
  used_materials: {
    label: 'Materials used',
    description: 'What it was made from (wood, brick, metal, etc.).',
  },
  route_places: {
    label: 'Places on the route',
    description: 'Stops or neighbourhoods along a procession or journey.',
  },
};

/** Apply plain-language overrides for contribute UI. */
export function withContributePlainCopy(
  field: OntologyField,
  opts?: { showExpertFields?: boolean },
): OntologyField | null {
  const plain = CONTRIBUTE_FIELD_PLAIN_COPY[field.key];
  if (!plain) return field;
  if (plain.hideByDefault && !opts?.showExpertFields) return null;
  return {
    ...field,
    label: plain.label ?? field.label,
    description: plain.description ?? field.description,
    help: plain.help ?? field.help,
  };
}
