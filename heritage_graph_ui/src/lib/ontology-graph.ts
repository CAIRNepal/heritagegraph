/**
 * HeritageGraph Ontology — Complete class hierarchy & object-property data
 * for the Cytoscape.js graph visualization.
 *
 * Auto-derived from Heritage.ttl (Feb 3, 2026).
 * Metrics:  111 classes (HeritageGraph namespace)
 *           118 object properties
 *            74 subClassOf (is_a) edges
 *           163 restriction-based object-property edges
 *             5 AAT architectural-style classes
 *             1 CIDOC-CRM E55_Type class
 *             2 union classes (AssertableEntity, PhysicalHeritageThing)
 */

/* ══════════════════════════════════════════════════════
 *  Types
 * ══════════════════════════════════════════════════════ */

export type OntologyCategory =
  | 'tangible'
  | 'conceptual'
  | 'event'
  | 'social'
  | 'spatial'
  | 'provenance'
  | 'kumari'
  | 'enum'
  | 'external';

export interface OntologyNode {
  id: string;
  label: string;
  category: OntologyCategory;
  cidocMapping: string;
  description: string;
  parent?: string;
}

export interface OntologyEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  edgeType: 'is_a' | 'object_property';
}

export interface OntologyGraphData {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
}

/* ══════════════════════════════════════════════════════
 *  Category colours (for Cytoscape styles & legend)
 * ══════════════════════════════════════════════════════ */

export const CATEGORY_COLORS: Record<OntologyCategory, { bg: string; border: string; text: string; label: string }> = {
  tangible:   { bg: '#3b82f6', border: '#2563eb', text: '#fff', label: 'Tangible Heritage' },
  conceptual: { bg: '#8b5cf6', border: '#7c3aed', text: '#fff', label: 'Conceptual Entities' },
  event:      { bg: '#f59e0b', border: '#d97706', text: '#fff', label: 'Events' },
  social:     { bg: '#10b981', border: '#059669', text: '#fff', label: 'Social / Actors' },
  spatial:    { bg: '#06b6d4', border: '#0891b2', text: '#fff', label: 'Spatiotemporal' },
  provenance: { bg: '#ec4899', border: '#db2777', text: '#fff', label: 'Provenance' },
  kumari:     { bg: '#ef4444', border: '#dc2626', text: '#fff', label: 'Living Goddess' },
  enum:       { bg: '#94a3b8', border: '#64748b', text: '#fff', label: 'Enumerations' },
  external:   { bg: '#78716c', border: '#57534e', text: '#fff', label: 'External (CRM/AAT)' },
};

/* ══════════════════════════════════════════════════════
 *  Helper — category assignment
 * ══════════════════════════════════════════════════════ */

function cat(id: string): OntologyCategory {
  if (id.startsWith('crm:') || id.startsWith('aat:')) return 'external';

  // Enum classes and their members
  if (id.includes('Enum') || id.includes('#')) return 'enum';

  // Kumari lifecycle
  if (id.startsWith('LivingGoddess')) return 'kumari';

  // Tangible heritage
  const tangible = [
    'HumanMadeObject','ArchitecturalStructure','Temple','BuddhistMonument',
    'Stupa','Chaitya','RestHouse','Pati','Sattal','Dharmashala',
    'WaterStructure','DhungeDhara','Pokhari',
    'IconographicObject','Paubha','Murti',
    'ArchitecturalElement','Technique','Material',
    'PhysicalHeritageThing',
  ];
  if (tangible.includes(id)) return 'tangible';

  // Events
  const events = [
    'Production','RitualEvent','Festival','ChariotFestival','MaskedDance',
    'Consecration','Enshrinement','TransferOfCustody',
    'ConditionAssessment','ConditionState','HistoricalEvent','DestructionEvent',
  ];
  if (events.includes(id)) return 'event';

  // Social / actors
  const social = ['Person','Actor','Guthi','CasteGroup'];
  if (social.includes(id)) return 'social';

  // Spatial
  const spatial = ['Place','TimeSpan','CalendarSystem'];
  if (spatial.includes(id)) return 'spatial';

  // Provenance
  const prov = [
    'HeritageAssertion','DataSource','DocumentationActivity',
    'InformationObject','FieldSurveyActivity','OralHistoryInterview',
    'Verification','FieldSurveyDataset','OralHistoryRecording',
    'ArchivalRecord','DataCustodian','AssertableEntity','Metadata',
  ];
  if (prov.includes(id)) return 'provenance';

  // Conceptual
  const conceptual = ['Deity','ReligiousTradition','SyncreticRelationship'];
  if (conceptual.includes(id)) return 'conceptual';

  // Ritual-type subtypes (not enum members but classes)
  const ritualTypes = [
    'Abhisheka','Bhajan','ChariotProcession','Homa','Jatra',
    'KamyaPuja','MaskedPerformance','NaimittikaPuja','NityaPuja',
    'Vrata','Yagna',
  ];
  if (ritualTypes.includes(id)) return 'event';

  // Container (root)
  if (id === 'Container') return 'provenance';

  return 'tangible';
}

/* ══════════════════════════════════════════════════════
 *  ALL 111 HeritageGraph classes + 6 external classes
 *  (exactly matching the ontology metrics table)
 * ══════════════════════════════════════════════════════ */

const NODES: OntologyNode[] = [
  // ── External classes (CIDOC-CRM / AAT) ──
  { id: 'crm:E55_Type',   label: 'E55 Type (ArchStyleEnum)', category: 'external', cidocMapping: 'crm:E55_Type',                 description: 'Architectural style vocabulary mapped to CIDOC E55 Type' },
  { id: 'aat:300004829',   label: 'Pagoda',                   category: 'external', cidocMapping: 'aat:300004829',                description: 'Multi-tiered roof style indigenous to Nepal' },
  { id: 'aat:300007576',   label: 'Stupa (AAT)',              category: 'external', cidocMapping: 'aat:300007576',                description: 'Buddhist dome-shaped reliquary (AAT)' },
  { id: 'aat:300007562',   label: 'Chaitya (AAT)',            category: 'external', cidocMapping: 'aat:300007562',                description: 'Buddhist votive shrine style (AAT)' },
  { id: 'aat:300446671',   label: 'Shikhara',                 category: 'external', cidocMapping: 'aat:300446671',                description: 'North Indian spire-shaped style' },
  { id: 'aat:300001285',   label: 'Dome',                     category: 'external', cidocMapping: 'aat:300001285',                description: 'Dome-based style (Mughal/Neo-classical influence)' },

  // ── Tangible Heritage ──
  { id: 'HumanMadeObject',        label: 'HumanMadeObject',        category: 'tangible',   cidocMapping: 'crm:E22_Human-Made_Object',  description: 'Physical objects created by human activity' },
  { id: 'ArchitecturalStructure', label: 'ArchitecturalStructure', category: 'tangible',   cidocMapping: 'crm:E22_Human-Made_Object',  description: 'Structures built for religious, social, or civic purposes', parent: 'HumanMadeObject' },
  { id: 'Temple',                 label: 'Temple',                 category: 'tangible',   cidocMapping: 'hg:Temple',                  description: 'Sacred structure with deity enshrinement and ritual activation', parent: 'ArchitecturalStructure' },
  { id: 'BuddhistMonument',      label: 'BuddhistMonument',      category: 'tangible',   cidocMapping: 'hg:BuddhistMonument',        description: 'Buddhist sacred structure with circumambulation patterns', parent: 'ArchitecturalStructure' },
  { id: 'Stupa',                  label: 'Stupa',                  category: 'tangible',   cidocMapping: 'hg:Stupa',                   description: 'Dome-shaped Buddhist reliquary shrine', parent: 'BuddhistMonument' },
  { id: 'Chaitya',               label: 'Chaitya',               category: 'tangible',   cidocMapping: 'hg:Chaitya',                 description: 'Buddhist votive shrine or prayer hall', parent: 'BuddhistMonument' },
  { id: 'RestHouse',             label: 'RestHouse',             category: 'tangible',   cidocMapping: 'hg:RestHouse',               description: 'Community structures for travelers and pilgrims', parent: 'ArchitecturalStructure' },
  { id: 'Pati',                   label: 'Pati',                   category: 'tangible',   cidocMapping: 'hg:Pati',                    description: 'Open-air pavilion for resting travelers', parent: 'RestHouse' },
  { id: 'Sattal',                label: 'Sattal',                category: 'tangible',   cidocMapping: 'hg:Sattal',                  description: 'Multi-story rest house (3-5 floors)', parent: 'RestHouse' },
  { id: 'Dharmashala',           label: 'Dharmashala',           category: 'tangible',   cidocMapping: 'hg:Dharmashala',             description: 'Pilgrim lodge operated by a Guthi', parent: 'RestHouse' },
  { id: 'WaterStructure',        label: 'WaterStructure',        category: 'tangible',   cidocMapping: 'hg:WaterStructure',          description: 'Engineered water supply systems', parent: 'ArchitecturalStructure' },
  { id: 'DhungeDhara',           label: 'DhungeDhara',           category: 'tangible',   cidocMapping: 'hg:DhungeDhara',             description: 'Stone spout (hiti) with carved imagery', parent: 'WaterStructure' },
  { id: 'Pokhari',               label: 'Pokhari',               category: 'tangible',   cidocMapping: 'hg:Pokhari',                 description: 'Pond or tank for water storage and ritual bathing', parent: 'WaterStructure' },
  { id: 'IconographicObject',    label: 'IconographicObject',    category: 'tangible',   cidocMapping: 'crm:E22_Human-Made_Object',  description: 'Sacred visual art objects depicting deities', parent: 'HumanMadeObject' },
  { id: 'Paubha',                label: 'Paubha',                category: 'tangible',   cidocMapping: 'hg:Paubha',                  description: 'Newari scroll painting (thangka)', parent: 'IconographicObject' },
  { id: 'Murti',                  label: 'Murti',                  category: 'tangible',   cidocMapping: 'hg:Murti',                   description: 'Consecrated statue serving as divine presence', parent: 'IconographicObject' },
  { id: 'ArchitecturalElement',  label: 'ArchitecturalElement',  category: 'tangible',   cidocMapping: 'crm:E25',                    description: 'Carved or constructed component (Gajur, Torana, Tundal)' },
  { id: 'PhysicalHeritageThing', label: 'PhysicalHeritageThing', category: 'tangible',   cidocMapping: 'crm:E18',                    description: 'Union class for all physical heritage entities' },
  { id: 'Technique',             label: 'Technique',             category: 'tangible',   cidocMapping: 'crm:E29',                    description: 'Method or craft process used in production or ritual' },
  { id: 'Material',              label: 'Material',              category: 'tangible',   cidocMapping: 'crm:E57_Material',           description: 'Physical substance used in construction or crafting' },

  // ── Conceptual Entities ──
  { id: 'Deity',                  label: 'Deity',                  category: 'conceptual', cidocMapping: 'crm:E28',                    description: 'Divine conceptual entity in Hindu, Buddhist, or syncretic traditions' },
  { id: 'ReligiousTradition',    label: 'ReligiousTradition',    category: 'conceptual', cidocMapping: 'crm:E55_Type',               description: 'Hindu, Buddhist, Syncretic tradition' },
  { id: 'SyncreticRelationship', label: 'SyncreticRelationship', category: 'conceptual', cidocMapping: 'crm:E13',                    description: 'Equivalence between divine entities across traditions' },

  // ── Events ──
  { id: 'Production',           label: 'Production',           category: 'event', cidocMapping: 'crm:E12_Production',           description: 'Event of creating a structure, murti, or paubha' },
  { id: 'RitualEvent',          label: 'RitualEvent',          category: 'event', cidocMapping: 'crm:E7_Activity',              description: 'Ritual activity that activates sacred space and invokes deities' },
  { id: 'Festival',             label: 'Festival',             category: 'event', cidocMapping: 'crm:E7_Activity',              description: 'Large-scale community ritual (Jatra)', parent: 'RitualEvent' },
  { id: 'ChariotFestival',     label: 'ChariotFestival',      category: 'event', cidocMapping: 'hg:ChariotFestival',           description: 'Ceremonial chariot procession (e.g., Rato Machhindranath)', parent: 'Festival' },
  { id: 'MaskedDance',         label: 'MaskedDance',          category: 'event', cidocMapping: 'hg:MaskedDance',              description: 'Festival with masked dancers embodying deities', parent: 'Festival' },
  { id: 'Consecration',        label: 'Consecration',         category: 'event', cidocMapping: 'crm:E7_Activity',              description: 'Ritual transforming object into sacred vessel (Prana Pratistha)' },
  { id: 'Enshrinement',        label: 'Enshrinement',         category: 'event', cidocMapping: 'crm:E7_Activity',              description: 'Installing deity murti in a temple sanctum' },
  { id: 'TransferOfCustody',   label: 'TransferOfCustody',    category: 'event', cidocMapping: 'crm:E10',                      description: 'Transfer of stewardship responsibility' },
  { id: 'ConditionAssessment', label: 'ConditionAssessment',  category: 'event', cidocMapping: 'crm:E14',                      description: 'Evaluation of physical condition of a heritage object' },
  { id: 'ConditionState',      label: 'ConditionState',       category: 'event', cidocMapping: 'crm:E3',                       description: 'A physical condition state of a heritage object' },
  { id: 'HistoricalEvent',     label: 'HistoricalEvent',      category: 'event', cidocMapping: 'crm:E5_Event',                 description: 'Major event affecting heritage (earthquake, fire, transition)' },
  { id: 'DestructionEvent',    label: 'DestructionEvent',     category: 'event', cidocMapping: 'crm:E6_Destruction',           description: 'Event destroying or damaging a structure', parent: 'HistoricalEvent' },

  // ── Ritual-type subclasses (classes under RitualTypeEnum) ──
  { id: 'Abhisheka',          label: 'Abhisheka',            category: 'event', cidocMapping: 'aat:300264383',                 description: 'Ritual bathing/anointing of deity', parent: 'RitualTypeEnum' },
  { id: 'Bhajan',             label: 'Bhajan',               category: 'event', cidocMapping: 'aat:300264388',                 description: 'Devotional singing ritual', parent: 'RitualTypeEnum' },
  { id: 'ChariotProcession',  label: 'ChariotProcession',    category: 'event', cidocMapping: 'hg:ChariotProcession',         description: 'Ceremonial chariot procession ritual', parent: 'RitualTypeEnum' },
  { id: 'Homa',               label: 'Homa',                 category: 'event', cidocMapping: 'aat:300264389',                 description: 'Sacred fire offering ritual', parent: 'RitualTypeEnum' },
  { id: 'Jatra',              label: 'Jatra',                category: 'event', cidocMapping: 'hg:Jatra',                     description: 'Festival procession (local term)', parent: 'RitualTypeEnum' },
  { id: 'KamyaPuja',          label: 'KamyaPuja',            category: 'event', cidocMapping: 'hg:KamyaPuja',                 description: 'Desire-fulfilling worship', parent: 'RitualTypeEnum' },
  { id: 'MaskedPerformance',  label: 'MaskedPerformance',    category: 'event', cidocMapping: 'hg:MaskedPerformance',         description: 'Ritualized masked dance performance', parent: 'RitualTypeEnum' },
  { id: 'NaimittikaPuja',     label: 'NaimittikaPuja',       category: 'event', cidocMapping: 'hg:NaimittikaPuja',            description: 'Occasional worship for special events', parent: 'RitualTypeEnum' },
  { id: 'NityaPuja',          label: 'NityaPuja',            category: 'event', cidocMapping: 'hg:NityaPuja',                 description: 'Daily obligatory worship', parent: 'RitualTypeEnum' },
  { id: 'Vrata',              label: 'Vrata',                category: 'event', cidocMapping: 'hg:Vrata',                     description: 'Ritual observance/fasting', parent: 'RitualTypeEnum' },
  { id: 'Yagna',              label: 'Yagna',                category: 'event', cidocMapping: 'hg:Yagna',                     description: 'Vedic fire sacrifice', parent: 'RitualTypeEnum' },

  // ── Social / Actors ──
  { id: 'Person',     label: 'Person',     category: 'social', cidocMapping: 'crm:E21_Person', description: 'Individual who performs, commissions, documents, or verifies heritage activities' },
  { id: 'Actor',      label: 'Actor',      category: 'social', cidocMapping: 'crm:E39_Actor',  description: 'General actor (person or group) responsible for events' },
  { id: 'Guthi',      label: 'Guthi',      category: 'social', cidocMapping: 'crm:E74_Group',  description: 'Endowed trust organization managing temples, rituals, and land' },
  { id: 'CasteGroup', label: 'CasteGroup', category: 'social', cidocMapping: 'crm:E74_Group',  description: 'Hereditary social group (Jati) with ritual roles' },

  // ── Spatiotemporal ──
  { id: 'Place',          label: 'Place',          category: 'spatial', cidocMapping: 'crm:E53_Place',     description: 'Geographic location where events occur and structures exist' },
  { id: 'TimeSpan',       label: 'TimeSpan',       category: 'spatial', cidocMapping: 'crm:E52_Time-Span', description: 'Temporal extent of an event or period' },
  { id: 'CalendarSystem', label: 'CalendarSystem', category: 'spatial', cidocMapping: 'time:Calendar',     description: 'Calendar reckoning system (Bikram Sambat, Nepal Sambat)' },

  // ── Provenance ──
  { id: 'HeritageAssertion',     label: 'HeritageAssertion',     category: 'provenance', cidocMapping: 'crminf:I2_Belief',    description: 'Factual claim with explicit source, author, and confidence' },
  { id: 'AssertableEntity',     label: 'AssertableEntity',      category: 'provenance', cidocMapping: 'crminf:E1_Entity',    description: 'Union class: any entity that can be the subject of a heritage assertion' },
  { id: 'DataSource',           label: 'DataSource',            category: 'provenance', cidocMapping: 'crm:E73',             description: 'Original source from which heritage information was derived' },
  { id: 'DocumentationActivity',label: 'DocumentationActivity', category: 'provenance', cidocMapping: 'crm:E7_Activity',     description: 'Process of recording information about a heritage entity' },
  { id: 'InformationObject',    label: 'InformationObject',     category: 'provenance', cidocMapping: 'crm:E73',             description: 'Recorded piece of information about heritage', parent: 'DataSource' },
  { id: 'FieldSurveyActivity',  label: 'FieldSurveyActivity',   category: 'provenance', cidocMapping: 'crmsci:S4',           description: 'On-site measurement and assessment', parent: 'DocumentationActivity' },
  { id: 'OralHistoryInterview', label: 'OralHistoryInterview',  category: 'provenance', cidocMapping: 'crm:E65_Creation',    description: 'Interview with a knowledge holder', parent: 'DocumentationActivity' },
  { id: 'Verification',         label: 'Verification',          category: 'provenance', cidocMapping: 'hg:Verification',     description: 'Cross-checking claims against multiple sources', parent: 'DocumentationActivity' },
  { id: 'FieldSurveyDataset',  label: 'FieldSurveyDataset',    category: 'provenance', cidocMapping: 'crm:E31_Document',    description: 'Structured data from a field survey', parent: 'DataSource' },
  { id: 'OralHistoryRecording',label: 'OralHistoryRecording',   category: 'provenance', cidocMapping: 'crm:E33',             description: 'Recording or transcript of an oral history', parent: 'DataSource' },
  { id: 'ArchivalRecord',      label: 'ArchivalRecord',        category: 'provenance', cidocMapping: 'hg:ArchivalRecord',   description: 'Government or institutional administrative record', parent: 'DataSource' },
  { id: 'DataCustodian',       label: 'DataCustodian',         category: 'provenance', cidocMapping: 'prov:Agent',           description: 'Institution stewarding heritage data' },
  { id: 'Metadata',            label: 'Metadata',              category: 'provenance', cidocMapping: 'hg:Metadata',          description: 'DataCite-aligned metadata record' },
  { id: 'Container',           label: 'Container',             category: 'provenance', cidocMapping: 'hg:Container',         description: 'Root container aggregating all entities (tree_root)' },

  // ── Living Goddess (Kumari) ──
  { id: 'LivingGoddessTenure',     label: 'LivingGoddessTenure',     category: 'kumari', cidocMapping: 'crm:E4_Period',                    description: 'Time-bounded role where a person embodies a deity as Kumari' },
  { id: 'LivingGoddessRetirement', label: 'LivingGoddessRetirement', category: 'kumari', cidocMapping: 'hg:LivingGoddessRetirement',       description: 'Event ending a Living Goddess tenure', parent: 'RitualEvent' },
  { id: 'LivingGoddessSelection',  label: 'LivingGoddessSelection',  category: 'kumari', cidocMapping: 'hg:LivingGoddessSelection',        description: 'Tantric ritual selecting a new Living Goddess', parent: 'RitualEvent' },

  // ── Enum parent classes ──
  { id: 'ConditionTypeEnum',    label: 'ConditionTypeEnum',    category: 'enum', cidocMapping: 'hg:ConditionTypeEnum',    description: 'Enumeration of physical condition types' },
  { id: 'ExistenceStatusEnum',  label: 'ExistenceStatusEnum',  category: 'enum', cidocMapping: 'hg:ExistenceStatusEnum',  description: 'Enumeration of existence statuses' },
  { id: 'DatePrecisionEnum',    label: 'DatePrecisionEnum',    category: 'enum', cidocMapping: 'hg:DatePrecisionEnum',    description: 'Enumeration of date precision levels' },
  { id: 'RitualTypeEnum',       label: 'RitualTypeEnum',       category: 'enum', cidocMapping: 'hg:RitualTypeEnum',       description: 'Enumeration of ritual types in Newar heritage' },
  { id: 'SyncreticTypeEnum',    label: 'SyncreticTypeEnum',    category: 'enum', cidocMapping: 'hg:SyncreticTypeEnum',    description: 'Enumeration of syncretic relationship types' },
  { id: 'GuthiTypeEnum',        label: 'GuthiTypeEnum',        category: 'enum', cidocMapping: 'hg:GuthiTypeEnum',        description: 'Enumeration of Guthi organizational types' },

  // ── Enum members: ConditionTypeEnum ──
  { id: 'ConditionTypeEnum_Good',     label: 'Good',     category: 'enum', cidocMapping: 'hg:ConditionTypeEnum#Good',     description: 'Well-preserved condition', parent: 'ConditionTypeEnum' },
  { id: 'ConditionTypeEnum_Damaged',  label: 'Damaged',  category: 'enum', cidocMapping: 'hg:ConditionTypeEnum#Damaged',  description: 'Visibly damaged condition', parent: 'ConditionTypeEnum' },
  { id: 'ConditionTypeEnum_Restored', label: 'Restored', category: 'enum', cidocMapping: 'hg:ConditionTypeEnum#Restored', description: 'Professionally restored', parent: 'ConditionTypeEnum' },
  { id: 'ConditionTypeEnum_Ruined',   label: 'Ruined',   category: 'enum', cidocMapping: 'hg:ConditionTypeEnum#Ruined',   description: 'Severely deteriorated', parent: 'ConditionTypeEnum' },

  // ── Enum members: ExistenceStatusEnum ──
  { id: 'ExistenceStatusEnum_Extant',          label: 'Extant',          category: 'enum', cidocMapping: 'hg:ExistenceStatusEnum#Extant',          description: 'Currently standing', parent: 'ExistenceStatusEnum' },
  { id: 'ExistenceStatusEnum_Destroyed',       label: 'Destroyed',       category: 'enum', cidocMapping: 'hg:ExistenceStatusEnum#Destroyed',       description: 'No longer exists', parent: 'ExistenceStatusEnum' },
  { id: 'ExistenceStatusEnum_Lost',            label: 'Lost',            category: 'enum', cidocMapping: 'hg:ExistenceStatusEnum#Lost',            description: 'Location unknown', parent: 'ExistenceStatusEnum' },
  { id: 'ExistenceStatusEnum_Hypothetical',    label: 'Hypothetical',    category: 'enum', cidocMapping: 'hg:ExistenceStatusEnum#Hypothetical',    description: 'Conjectured existence', parent: 'ExistenceStatusEnum' },
  { id: 'ExistenceStatusEnum_PartiallyExtant', label: 'PartiallyExtant', category: 'enum', cidocMapping: 'hg:ExistenceStatusEnum#PartiallyExtant', description: 'Partially surviving', parent: 'ExistenceStatusEnum' },
  { id: 'ExistenceStatusEnum_Unknown',         label: 'Unknown',         category: 'enum', cidocMapping: 'hg:ExistenceStatusEnum#Unknown',         description: 'Status not determined', parent: 'ExistenceStatusEnum' },

  // ── Enum members: DatePrecisionEnum ──
  { id: 'DatePrecisionEnum_Exact',   label: 'Exact',   category: 'enum', cidocMapping: 'hg:DatePrecisionEnum#Exact',   description: 'Precise date known', parent: 'DatePrecisionEnum' },
  { id: 'DatePrecisionEnum_Year',    label: 'Year',    category: 'enum', cidocMapping: 'hg:DatePrecisionEnum#Year',    description: 'Year-level precision', parent: 'DatePrecisionEnum' },
  { id: 'DatePrecisionEnum_Decade',  label: 'Decade',  category: 'enum', cidocMapping: 'hg:DatePrecisionEnum#Decade',  description: 'Decade-level precision', parent: 'DatePrecisionEnum' },
  { id: 'DatePrecisionEnum_Century', label: 'Century', category: 'enum', cidocMapping: 'hg:DatePrecisionEnum#Century', description: 'Century-level precision', parent: 'DatePrecisionEnum' },
  { id: 'DatePrecisionEnum_Circa',   label: 'Circa',   category: 'enum', cidocMapping: 'hg:DatePrecisionEnum#Circa',   description: 'Approximate date', parent: 'DatePrecisionEnum' },

  // ── Enum members: RitualTypeEnum ──
  { id: 'RitualTypeEnum_Circumambulation',    label: 'Circumambulation',    category: 'enum', cidocMapping: 'hg:RitualTypeEnum#Circumambulation',    description: 'Devotional walking around a sacred object', parent: 'RitualTypeEnum' },
  { id: 'RitualTypeEnum_InstallationRitual',  label: 'InstallationRitual',  category: 'enum', cidocMapping: 'hg:RitualTypeEnum#InstallationRitual',  description: 'Ritual installing a sacred object', parent: 'RitualTypeEnum' },
  { id: 'RitualTypeEnum_DeinstallationRitual',label: 'DeinstallationRitual',category: 'enum', cidocMapping: 'hg:RitualTypeEnum#DeinstallationRitual',description: 'Ritual removing a sacred object', parent: 'RitualTypeEnum' },
  { id: 'RitualTypeEnum_ProcessionRitual',    label: 'ProcessionRitual',    category: 'enum', cidocMapping: 'hg:RitualTypeEnum#ProcessionRitual',    description: 'Ritual procession through streets', parent: 'RitualTypeEnum' },
  { id: 'RitualTypeEnum_ProcessionalMovement',label: 'ProcessionalMovement',category: 'enum', cidocMapping: 'hg:RitualTypeEnum#ProcessionalMovement',description: 'Movement of deity through a route', parent: 'RitualTypeEnum' },
  { id: 'RitualTypeEnum_RelicTour',           label: 'RelicTour',           category: 'enum', cidocMapping: 'hg:RitualTypeEnum#RelicTour',           description: 'Touring of sacred relics', parent: 'RitualTypeEnum' },
  { id: 'RitualTypeEnum_ReturningRitual',     label: 'ReturningRitual',     category: 'enum', cidocMapping: 'hg:RitualTypeEnum#ReturningRitual',     description: 'Returning deity to sanctum', parent: 'RitualTypeEnum' },
  { id: 'RitualTypeEnum_RitualConsecration',  label: 'RitualConsecration',  category: 'enum', cidocMapping: 'hg:RitualTypeEnum#RitualConsecration',  description: 'Consecration as a ritual type', parent: 'RitualTypeEnum' },

  // ── Enum members: SyncreticTypeEnum ──
  { id: 'SyncreticTypeEnum_Equivalence',   label: 'Equivalence',   category: 'enum', cidocMapping: 'hg:SyncreticTypeEnum#Equivalence',   description: 'Two deities considered identical', parent: 'SyncreticTypeEnum' },
  { id: 'SyncreticTypeEnum_Fusion',        label: 'Fusion',        category: 'enum', cidocMapping: 'hg:SyncreticTypeEnum#Fusion',        description: 'Merged deity identity', parent: 'SyncreticTypeEnum' },
  { id: 'SyncreticTypeEnum_Appropriation', label: 'Appropriation', category: 'enum', cidocMapping: 'hg:SyncreticTypeEnum#Appropriation', description: 'One tradition absorbing another deity', parent: 'SyncreticTypeEnum' },
  { id: 'SyncreticTypeEnum_Historical',    label: 'Historical',    category: 'enum', cidocMapping: 'hg:SyncreticTypeEnum#Historical',    description: 'Historical syncretism documented in sources', parent: 'SyncreticTypeEnum' },

  // ── Enum members: GuthiTypeEnum ──
  { id: 'GuthiTypeEnum_PujaGuthi',   label: 'PujaGuthi',   category: 'enum', cidocMapping: 'hg:GuthiTypeEnum#PujaGuthi',   description: 'Guthi managing daily temple worship', parent: 'GuthiTypeEnum' },
  { id: 'GuthiTypeEnum_JatraGuthi',  label: 'JatraGuthi',  category: 'enum', cidocMapping: 'hg:GuthiTypeEnum#JatraGuthi',  description: 'Guthi organizing festivals', parent: 'GuthiTypeEnum' },
  { id: 'GuthiTypeEnum_SiGuthi',     label: 'SiGuthi',     category: 'enum', cidocMapping: 'hg:GuthiTypeEnum#SiGuthi',     description: 'Guthi managing death rites', parent: 'GuthiTypeEnum' },
  { id: 'GuthiTypeEnum_NashaGuthi',  label: 'NashaGuthi',  category: 'enum', cidocMapping: 'hg:GuthiTypeEnum#NashaGuthi',  description: 'Guthi managing lineage rituals', parent: 'GuthiTypeEnum' },
  { id: 'GuthiTypeEnum_RajGuthi',    label: 'RajGuthi',    category: 'enum', cidocMapping: 'hg:GuthiTypeEnum#RajGuthi',    description: 'Royal state-endowed Guthi', parent: 'GuthiTypeEnum' },
  { id: 'GuthiTypeEnum_SanGuthi',    label: 'SanGuthi',    category: 'enum', cidocMapping: 'hg:GuthiTypeEnum#SanGuthi',    description: 'General community Guthi', parent: 'GuthiTypeEnum' },
  { id: 'GuthiTypeEnum_SanaGuthi',   label: 'SanaGuthi',   category: 'enum', cidocMapping: 'hg:GuthiTypeEnum#SanaGuthi',   description: 'Small neighbourhood Guthi', parent: 'GuthiTypeEnum' },
  { id: 'GuthiTypeEnum_TempleGuthi', label: 'TempleGuthi', category: 'enum', cidocMapping: 'hg:GuthiTypeEnum#TempleGuthi', description: 'Guthi managing a specific temple', parent: 'GuthiTypeEnum' },
];

/* ══════════════════════════════════════════════════════
 *  is_a hierarchy edges (74 from TTL subClassOf)
 * ══════════════════════════════════════════════════════ */

const IS_A_EDGES: OntologyEdge[] = NODES
  .filter((n) => n.parent)
  .map((n) => ({
    id: `isa__${n.id}__${n.parent}`,
    source: n.id,
    target: n.parent!,
    label: 'is_a',
    edgeType: 'is_a' as const,
  }));

/* ══════════════════════════════════════════════════════
 *  Object-property edges (from owl:Restriction blocks)
 *  163 edges extracted from Heritage.ttl
 * ══════════════════════════════════════════════════════ */

type E = [string, string, string]; // [source, label, target]

const OP_RAW: E[] = [
  // ── ArchitecturalElement ──
  ['ArchitecturalElement', 'is_component_of', 'ArchitecturalStructure'],

  // ── ArchitecturalStructure ──
  ['ArchitecturalStructure', 'destruction_event', 'DestructionEvent'],
  ['ArchitecturalStructure', 'documented_in_source', 'DataSource'],
  ['ArchitecturalStructure', 'existence_status', 'ExistenceStatusEnum'],
  ['ArchitecturalStructure', 'has_architectural_style', 'crm:E55_Type'],
  ['ArchitecturalStructure', 'has_component', 'ArchitecturalElement'],
  ['ArchitecturalStructure', 'has_condition_assessment', 'ConditionAssessment'],
  ['ArchitecturalStructure', 'has_current_location', 'Place'],
  ['ArchitecturalStructure', 'has_provenance_assertion', 'HeritageAssertion'],
  ['ArchitecturalStructure', 'hypothesized_location', 'Place'],
  ['ArchitecturalStructure', 'was_produced_by_event', 'Production'],

  // ── CalendarSystem ──
  ['CalendarSystem', 'is_primary_for_tradition', 'ReligiousTradition'],

  // ── ConditionAssessment ──
  ['ConditionAssessment', 'assessed_condition_state', 'ConditionState'],
  ['ConditionAssessment', 'assessed_object', 'PhysicalHeritageThing'],
  ['ConditionAssessment', 'carried_out_by', 'Actor'],
  ['ConditionAssessment', 'has_timespan', 'TimeSpan'],

  // ── ConditionState ──
  ['ConditionState', 'has_condition_type', 'ConditionTypeEnum'],

  // ── Consecration ──
  ['Consecration', 'carried_out_by', 'Actor'],
  ['Consecration', 'consecrated_object', 'Murti'],
  ['Consecration', 'has_timespan', 'TimeSpan'],
  ['Consecration', 'makes_deity_present', 'Deity'],
  ['Consecration', 'took_place_at', 'Place'],

  // ── Container (root) ──
  ['Container', 'architectural_elements', 'ArchitecturalElement'],
  ['Container', 'calendar_systems', 'CalendarSystem'],
  ['Container', 'caste_groups', 'CasteGroup'],
  ['Container', 'consecration_events', 'Consecration'],
  ['Container', 'custody_events', 'TransferOfCustody'],
  ['Container', 'data_custodians', 'DataCustodian'],
  ['Container', 'data_sources', 'DataSource'],
  ['Container', 'deities', 'Deity'],
  ['Container', 'documentation_activities', 'DocumentationActivity'],
  ['Container', 'enshrinement_events', 'Enshrinement'],
  ['Container', 'festivals', 'Festival'],
  ['Container', 'guthis', 'Guthi'],
  ['Container', 'has_architectural_style', 'crm:E55_Type'],
  ['Container', 'information_objects', 'InformationObject'],
  ['Container', 'materials', 'Material'],
  ['Container', 'metadata', 'Metadata'],
  ['Container', 'persons', 'Person'],
  ['Container', 'physical_heritage_things', 'PhysicalHeritageThing'],
  ['Container', 'places', 'Place'],
  ['Container', 'production_events', 'Production'],
  ['Container', 'provenance_assertions', 'HeritageAssertion'],
  ['Container', 'religious_traditions', 'ReligiousTradition'],
  ['Container', 'ritual_events', 'RitualEvent'],
  ['Container', 'syncretic_relationships', 'SyncreticRelationship'],

  // ── DataSource ──
  ['DataSource', 'datacite_creator', 'Actor'],
  ['DataSource', 'datacite_publisher', 'Actor'],
  ['DataSource', 'publication_timespan', 'TimeSpan'],

  // ── Deity ──
  ['Deity', 'has_religious_tradition', 'ReligiousTradition'],
  ['Deity', 'is_depicted_in', 'IconographicObject'],
  ['Deity', 'is_enshrined_through_event', 'Enshrinement'],
  ['Deity', 'is_invoked_in_ritual', 'RitualEvent'],

  // ── DestructionEvent ──
  ['DestructionEvent', 'has_timespan', 'TimeSpan'],
  ['DestructionEvent', 'took_place_at', 'Place'],

  // ── DocumentationActivity ──
  ['DocumentationActivity', 'generated_assertion', 'HeritageAssertion'],
  ['DocumentationActivity', 'has_timespan', 'TimeSpan'],
  ['DocumentationActivity', 'performed_by_agent', 'Person'],
  ['DocumentationActivity', 'produced_information_object', 'InformationObject'],
  ['DocumentationActivity', 'subject_entity', 'PhysicalHeritageThing'],
  ['DocumentationActivity', 'subject_event', 'RitualEvent'],

  // ── Enshrinement ──
  ['Enshrinement', 'carried_out_by', 'Actor'],
  ['Enshrinement', 'enshrined_deity', 'Deity'],
  ['Enshrinement', 'enshrined_in_structure', 'Temple'],
  ['Enshrinement', 'has_timespan', 'TimeSpan'],

  // ── Festival ──
  ['Festival', 'includes_ritual_event', 'RitualEvent'],

  // ── Guthi ──
  ['Guthi', 'guthi_type', 'GuthiTypeEnum'],
  ['Guthi', 'has_membership', 'Person'],
  ['Guthi', 'holds_custody_of', 'ArchitecturalStructure'],
  ['Guthi', 'performs_ritual', 'RitualEvent'],

  // ── HeritageAssertion ──
  ['HeritageAssertion', 'asserts_about_entity', 'AssertableEntity'],
  ['HeritageAssertion', 'asserts_about_event', 'RitualEvent'],
  ['HeritageAssertion', 'supersedes_assertion', 'HeritageAssertion'],
  ['HeritageAssertion', 'was_attributed_to_agent', 'Person'],
  ['HeritageAssertion', 'was_derived_from_source', 'DataSource'],

  // ── HistoricalEvent ──
  ['HistoricalEvent', 'architectural_structures', 'ArchitecturalStructure'],
  ['HistoricalEvent', 'has_timespan', 'TimeSpan'],
  ['HistoricalEvent', 'includes_ritual_event', 'RitualEvent'],
  ['HistoricalEvent', 'took_place_at', 'Place'],

  // ── HumanMadeObject ──
  ['HumanMadeObject', 'has_condition_assessment', 'ConditionAssessment'],
  ['HumanMadeObject', 'has_current_location', 'Place'],
  ['HumanMadeObject', 'has_custody_event', 'TransferOfCustody'],
  ['HumanMadeObject', 'participates_in_ritual', 'RitualEvent'],
  ['HumanMadeObject', 'was_documented_by', 'DocumentationActivity'],
  ['HumanMadeObject', 'was_produced_by_event', 'Production'],

  // ── IconographicObject ──
  ['IconographicObject', 'depicts_deity', 'Deity'],
  ['IconographicObject', 'has_current_location', 'Place'],
  ['IconographicObject', 'participates_in_ritual', 'RitualEvent'],
  ['IconographicObject', 'used_by', 'Actor'],
  ['IconographicObject', 'was_produced_by_event', 'Production'],

  // ── InformationObject ──
  ['InformationObject', 'created_by_documentation', 'DocumentationActivity'],
  ['InformationObject', 'is_about_entity', 'ArchitecturalStructure'],
  ['InformationObject', 'is_about_event', 'RitualEvent'],
  ['InformationObject', 'was_documented_by', 'DocumentationActivity'],

  // ── LivingGoddessRetirement ──
  ['LivingGoddessRetirement', 'carried_out_by', 'Person'],
  ['LivingGoddessRetirement', 'ended_tenure_of', 'LivingGoddessTenure'],
  ['LivingGoddessRetirement', 'has_provenance_assertion', 'HeritageAssertion'],
  ['LivingGoddessRetirement', 'has_timespan', 'TimeSpan'],
  ['LivingGoddessRetirement', 'took_place_at', 'Place'],
  ['LivingGoddessRetirement', 'was_documented_by', 'DocumentationActivity'],

  // ── LivingGoddessSelection ──
  ['LivingGoddessSelection', 'carried_out_by', 'Actor'],
  ['LivingGoddessSelection', 'has_provenance_assertion', 'HeritageAssertion'],
  ['LivingGoddessSelection', 'has_timespan', 'TimeSpan'],
  ['LivingGoddessSelection', 'initiated_tenure', 'LivingGoddessTenure'],
  ['LivingGoddessSelection', 'selected_person', 'Person'],
  ['LivingGoddessSelection', 'took_place_at', 'Place'],
  ['LivingGoddessSelection', 'was_documented_by', 'DocumentationActivity'],

  // ── LivingGoddessTenure ──
  ['LivingGoddessTenure', 'embodied_deity', 'Deity'],
  ['LivingGoddessTenure', 'had_participant', 'Person'],
  ['LivingGoddessTenure', 'has_retirement_event', 'LivingGoddessRetirement'],
  ['LivingGoddessTenure', 'has_timespan', 'TimeSpan'],
  ['LivingGoddessTenure', 'residence_structure', 'ArchitecturalStructure'],
  ['LivingGoddessTenure', 'supported_by_institution', 'Guthi'],
  ['LivingGoddessTenure', 'was_documented_by', 'DocumentationActivity'],

  // ── Murti ──
  ['Murti', 'consecrated_by_event', 'Consecration'],
  ['Murti', 'is_about_deity', 'Deity'],

  // ── Person ──
  ['Person', 'birth_timespan', 'TimeSpan'],
  ['Person', 'carried_out_activity', 'RitualEvent'],
  ['Person', 'death_timespan', 'TimeSpan'],
  ['Person', 'member_of_group', 'Guthi'],

  // ── Place ──
  ['Place', 'contains_structure', 'ArchitecturalStructure'],

  // ── Production ──
  ['Production', 'carried_out_by', 'Actor'],
  ['Production', 'commissioned_by', 'Actor'],
  ['Production', 'has_provenance_assertion', 'HeritageAssertion'],
  ['Production', 'has_timespan', 'TimeSpan'],
  ['Production', 'produced_object', 'PhysicalHeritageThing'],
  ['Production', 'took_place_at', 'Place'],
  ['Production', 'used_technique', 'Technique'],
  ['Production', 'was_documented_by', 'DocumentationActivity'],

  // ── RitualEvent ──
  ['RitualEvent', 'carried_out_by', 'Actor'],
  ['RitualEvent', 'end_place', 'Place'],
  ['RitualEvent', 'has_provenance_assertion', 'HeritageAssertion'],
  ['RitualEvent', 'has_timespan', 'TimeSpan'],
  ['RitualEvent', 'invokes_deity', 'Deity'],
  ['RitualEvent', 'is_part_of_festival', 'Festival'],
  ['RitualEvent', 'managed_by_guthi', 'Guthi'],
  ['RitualEvent', 'occurs_after', 'RitualEvent'],
  ['RitualEvent', 'occurs_before', 'RitualEvent'],
  ['RitualEvent', 'ritual_on_structure', 'PhysicalHeritageThing'],
  ['RitualEvent', 'ritual_type', 'RitualTypeEnum'],
  ['RitualEvent', 'route_places', 'Place'],
  ['RitualEvent', 'start_place', 'Place'],
  ['RitualEvent', 'used_materials', 'Material'],
  ['RitualEvent', 'was_documented_by', 'DocumentationActivity'],

  // ── SyncreticRelationship ──
  ['SyncreticRelationship', 'assigned_equivalent', 'Deity'],
  ['SyncreticRelationship', 'assigned_to_deity', 'Deity'],
  ['SyncreticRelationship', 'documented_in_source', 'DataSource'],
  ['SyncreticRelationship', 'syncretic_type', 'SyncreticTypeEnum'],
  ['SyncreticRelationship', 'was_derived_from_source', 'DataSource'],
  ['SyncreticRelationship', 'was_documented_by', 'DocumentationActivity'],

  // ── Temple ──
  ['Temple', 'enshrines_deity_through_event', 'Enshrinement'],
  ['Temple', 'has_architectural_style', 'crm:E55_Type'],

  // ── TimeSpan ──
  ['TimeSpan', 'calendar_system', 'CalendarSystem'],
  ['TimeSpan', 'date_precision', 'DatePrecisionEnum'],

  // ── TransferOfCustody ──
  ['TransferOfCustody', 'has_timespan', 'TimeSpan'],
  ['TransferOfCustody', 'took_place_at', 'Place'],
  ['TransferOfCustody', 'transferred_from_actor', 'Actor'],
  ['TransferOfCustody', 'transferred_object', 'PhysicalHeritageThing'],
  ['TransferOfCustody', 'transferred_to_actor', 'Actor'],
  ['TransferOfCustody', 'transferred_to_guthi', 'Guthi'],

  // ── Verification ──
  ['Verification', 'verified_assertion', 'HeritageAssertion'],
  ['Verification', 'verified_by_expert', 'Person'],

  // ── AAT architectural styles → E55_Type ──
  ['aat:300004829', 'subClassOf', 'crm:E55_Type'],
  ['aat:300007576', 'subClassOf', 'crm:E55_Type'],
  ['aat:300007562', 'subClassOf', 'crm:E55_Type'],
  ['aat:300446671', 'subClassOf', 'crm:E55_Type'],
  ['aat:300001285', 'subClassOf', 'crm:E55_Type'],
];

const PROPERTY_EDGES: OntologyEdge[] = OP_RAW.map(([s, l, t], i) => ({
  id: `op_${i}`,
  source: s,
  target: t,
  label: l,
  edgeType: l === 'subClassOf' ? 'is_a' as const : 'object_property' as const,
}));

/* ══════════════════════════════════════════════════════
 *  Public API
 * ══════════════════════════════════════════════════════ */

export function getOntologyGraphData(): OntologyGraphData {
  return {
    nodes: NODES,
    edges: [...IS_A_EDGES, ...PROPERTY_EDGES],
  };
}

export function getNodeById(id: string): OntologyNode | undefined {
  return NODES.find((n) => n.id === id);
}

export function getNodesByCategory(c: OntologyCategory): OntologyNode[] {
  return NODES.filter((n) => n.category === c);
}

export function getEdgesForNode(nodeId: string): OntologyEdge[] {
  return [...IS_A_EDGES, ...PROPERTY_EDGES].filter(
    (e) => e.source === nodeId || e.target === nodeId,
  );
}

export function getOntologyStats() {
  const data = getOntologyGraphData();
  const hgNodes = data.nodes.filter((n) => n.category !== 'external');
  return {
    totalClasses: hgNodes.length,
    objectProperties: data.edges.filter((e) => e.edgeType === 'object_property').length,
    hierarchyEdges: data.edges.filter((e) => e.edgeType === 'is_a').length,
    categories: new Set(data.nodes.map((n) => n.category)).size,
    externalClasses: data.nodes.filter((n) => n.category === 'external').length,
    enumMembers: data.nodes.filter((n) => n.id.includes('_') && n.parent?.includes('Enum')).length,
  };
}
