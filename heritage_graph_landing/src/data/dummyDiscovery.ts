/**
 * Discovery UI config for the public landing page.
 * Category ids must match `type` values accepted by GET /cidoc/discovery/
 * (see heritage_graph/apps/cidoc_data/views.py `_DISCOVERY_TYPE_MAP`).
 */

export type DiscoveryCategory =
  | 'monuments'
  | 'festivals'
  | 'deities'
  | 'persons'
  | 'guthis'
  | 'rituals';

export interface DiscoveryCategoryMeta {
  id: DiscoveryCategory;
  /** Short label on category tab */
  shortLabel: string;
  /** Plural heading label */
  label: string;
  /** Subheading copy under result count */
  description: string;
}

export const DISCOVERY_CATEGORIES: DiscoveryCategoryMeta[] = [
  {
    id: 'persons',
    shortLabel: 'Persons',
    label: 'Person',
    description: 'Historical and cultural figures.',
  },
  {
    id: 'monuments',
    shortLabel: 'Monuments',
    label: 'Monument',
    description: 'Heritage monuments and sites.',
  },
  {
    id: 'festivals',
    shortLabel: 'Festivals',
    label: 'Festival',
    description: 'Festivals and public celebrations.',
  },
  {
    id: 'deities',
    shortLabel: 'Deities',
    label: 'Deity',
    description: 'Deities and iconographic subjects.',
  },
  {
    id: 'guthis',
    shortLabel: 'Guthis',
    label: 'Guthi',
    description: 'Traditional trusts and community institutions.',
  },
  {
    id: 'rituals',
    shortLabel: 'Rituals',
    label: 'Ritual',
    description: 'Ritual events and ceremonial practice.',
  },
];

/** Valley labels for client-side location facet filtering (matches API text fields). */
export const FACET_VALLEYS: string[] = [
  'Kathmandu',
  'Lalitpur',
  'Bhaktapur',
  'Patan',
  'Kirtipur',
  'Pokhara',
  'Janakpur',
  'Lumbini',
];
