/** Heritage Atlas types aligned with ontology/HeritageGraph.yaml (CIDOC-CRM + PROV-O). */

export type AtlasEra = 'ancient' | 'medieval' | 'early_modern' | 'modern';

export type EventKind =
  | 'built'
  | 'renovated'
  | 'damaged'
  | 'restored'
  | 'rediscovered'
  | 'consecrated'
  | 'documented';

export interface AtlasEvent {
  year: number;
  kind: EventKind;
  description: string;
}

export type OntologyClass =
  | 'Temple'
  | 'Stupa'
  | 'Chaitya'
  | 'Pati'
  | 'Sattal'
  | 'Dharmashala'
  | 'DhungeDhara'
  | 'Pokhari'
  | 'Murti'
  | 'Paubha'
  | 'ArchitecturalElement'
  | 'Deity'
  | 'Festival'
  | 'ChariotFestival'
  | 'MaskedDance'
  | 'RitualEvent'
  | 'Person'
  | 'Guthi'
  | 'CasteGroup'
  | 'HistoricalEvent'
  | 'LivingGoddessTenure';

export type ReconciliationStatus = 'confirmed' | 'conflicting' | 'unverified';

export interface HeritageAssertion {
  id: string;
  assertedProperty: string;
  assertedValue: string;
  attributedToAgentId: string;
  derivedFromSourceIds: string[];
  generatedAtTime: string;
  confidenceScore: number;
  reconciliationStatus: ReconciliationStatus;
  supersedesAssertionId?: string;
}

export type ReliabilityTier = 'A' | 'B' | 'C' | 'D';

export interface DataSource {
  id: string;
  name: string;
  sourceType: string;
  reliabilityTier: ReliabilityTier;
  citation: string;
  archivalLocation?: string;
}

export type AgentRole = 'researcher' | 'priest' | 'curator' | 'community' | 'system';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  institutionalAffiliation?: string;
}

export interface OntologyEdge {
  id: string;
  source: string;
  target: string;
  predicate: string;
  /** True when the edge is backed by an accepted HeritageAssertion (live KG). */
  hasProvenance?: boolean;
}

/** How WGS84 coordinates were resolved (research-grade epistemic labeling). */
export type AtlasCoordProvenance = 'verified' | 'gazetteer' | 'inherited' | 'unmapped';

/** Image attribution metadata (mirrors KG projection imageCredits). */
export interface AtlasImageCredit {
  license?: string;
  licenseUrl?: string;
  artist?: string;
  descriptionUrl?: string;
  source?: string;
  retrieved?: string;
}

/** Shared entity fields; spatial coords optional when anchorEntityIds present. */
export interface AtlasEntity {
  id: string;
  name: string;
  nameNe?: string;
  class: OntologyClass;
  era: AtlasEra;
  summary: string;
  assertions: HeritageAssertion[];
  foundedYear?: number;
  lastKnownExistenceYear?: number | null;
  events: AtlasEvent[];
  relatedEntityIds: string[];
  /** Geolocation when entity has a fixed place on Earth */
  lat?: number;
  lon?: number;
  height?: number;
  /** Coordinate resolution tier (live corpus); unmapped rows appear in catalog only. */
  coordProvenance?: AtlasCoordProvenance;
  /** CIDOC list category (`location`, `structure`, …) for filters and place catalog. */
  recordCategory?: string;
  /** Location.type or similar subtype when recordCategory is location. */
  locationType?: string;
  /** IDs of spatial entities this row anchors to (festivals, persons, guthi, etc.) */
  anchorEntityIds?: string[];
  /** Ritual type enum label when class is RitualEvent */
  ritualType?: string;
  /** Knowledge UI domain slug (`/knowledge/<domain>/view/...`) when backed by CIDOC */
  knowledgeDomain?: string;
  /** CIDOC record primary key for deep links */
  cidocRecordId?: string;
  /** Primary image from the KG projection (live corpus). */
  imageUrl?: string;
  images?: string[];
  imageCredits?: Record<string, AtlasImageCredit>;
  /** Curated HeritageGraph node vs linked Yale LUX stub (live corpus). */
  sourceLayer?: 'curated' | 'lux';
  /** External canonical URI when this entity is a linked LUX stub. */
  externalUri?: string;
}

export type AtlasViewId =
  | 'globe'
  | 'graph'
  | 'documents'
  | 'time'
  | 'search'
  | 'ai'
  | 'ops';

export const ATLAS_VIEW_IDS: AtlasViewId[] = [
  'globe',
  'graph',
  'documents',
  'time',
  'search',
  'ai',
  'ops',
];

export const ONTOLOGY_CLASSES: OntologyClass[] = [
  'Temple',
  'Stupa',
  'Chaitya',
  'Pati',
  'Sattal',
  'Dharmashala',
  'DhungeDhara',
  'Pokhari',
  'Murti',
  'Paubha',
  'ArchitecturalElement',
  'Deity',
  'Festival',
  'ChariotFestival',
  'MaskedDance',
  'RitualEvent',
  'Person',
  'Guthi',
  'CasteGroup',
  'HistoricalEvent',
  'LivingGoddessTenure',
];

export const RELIABILITY_ORDER: ReliabilityTier[] = ['A', 'B', 'C', 'D'];

export function tierRank(tier: ReliabilityTier): number {
  return RELIABILITY_ORDER.indexOf(tier);
}
