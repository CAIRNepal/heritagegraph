// AUTO-GENERATED — do not edit by hand.
// Source:  ontology/HeritageGraph.yaml + tools/ui-vizmap.yaml
// Regen:   python3 tools/gen_heritage_viz_config.py
// Hash:    a9b45f29bd9d32de
//
// This file is the single source of truth for graph-visualization ontology
// config consumed by:
//   - heritage-museum page  (NodeType, NODE_TYPE_CONFIG, RELATION_LABELS)
//   - ForceGraph component  (NODE_TYPE_CONFIG, RELATION_LABELS)
//   - All RDF-aware frontend code (RDF_PREFIXES, HG_CATEGORY_CONFIG)


/** RDF namespace prefixes — derived from ontology/HeritageGraph.yaml. */
export const RDF_PREFIXES: Readonly<Record<string, string>> = {
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  owl: "http://www.w3.org/2002/07/owl#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
  crm: "http://www.cidoc-crm.org/cidoc-crm/",
  heritageGraph: "https://w3id.org/heritagegraph/",
  geo: "http://www.opengis.net/ont/geosparql#",
  prov: "http://www.w3.org/ns/prov#",
};

/**
 * HeritageGraph node types for the knowledge-graph visualization.
 * Each key maps to a LinkML class in ontology/HeritageGraph.yaml.
 */
export type NodeType =
  | 'Place'
  | 'Temple'
  | 'BuddhistMonument'
  | 'ArchitecturalStructure'
  | 'Settlement'
  | 'Deity'
  | 'Festival'
  | 'TimeSpan'
  | 'ReligiousTradition'
  | 'SacredSite'
  | 'Person'
  | 'Guthi'
  | 'IconographicObject'
  | 'HistoricalPeriod'
  | 'Source'
  | 'HistoricalEvent'
  | 'RitualEvent'
  | 'CasteGroup'
  | 'LivingGoddessTenure'
  | 'SyncreticRelationship'
  | 'HumanMadeObject'
  | 'Group'
  | 'Set';

export type HgCategory = 'tangible' | 'conceptual' | 'event' | 'spatial' | 'temporal' | 'actor' | 'provenance';

/** Visual configuration for each NodeType in the force-directed graph. */
export const NODE_TYPE_CONFIG: Record<
  NodeType,
  { color: string; glowColor: string; emoji: string; label: string; cidocMapping: string; hgCategory: string }
> = {
  Place: { color: '#48755f', glowColor: '#68bb92', emoji: '🏔', label: 'Place', cidocMapping: 'crm:E53_Place', hgCategory: 'spatial' },
  Temple: { color: '#ac5236', glowColor: '#e08468', emoji: '🛕', label: 'Temple', cidocMapping: 'heritageGraph:Temple', hgCategory: 'tangible' },
  BuddhistMonument: { color: '#b8583a', glowColor: '#e38f75', emoji: '☸', label: 'Buddhist Monument', cidocMapping: 'heritageGraph:BuddhistMonument', hgCategory: 'tangible' },
  ArchitecturalStructure: { color: '#c35e40', glowColor: '#e69a83', emoji: '🏛', label: 'Architectural Structure', cidocMapping: 'heritageGraph:ArchitecturalStructure', hgCategory: 'tangible' },
  Settlement: { color: '#4e7e66', glowColor: '#72c099', emoji: '🏙', label: 'Settlement', cidocMapping: 'hg:Settlement → crm:E53_Place', hgCategory: 'spatial' },
  Deity: { color: '#9d5579', glowColor: '#d187ac', emoji: '🪷', label: 'Deity', cidocMapping: 'heritageGraph:Deity', hgCategory: 'conceptual' },
  Festival: { color: '#a25926', glowColor: '#e68a48', emoji: '🪔', label: 'Festival', cidocMapping: 'heritageGraph:Festival', hgCategory: 'event' },
  TimeSpan: { color: '#826749', glowColor: '#c49b6d', emoji: '📜', label: 'Time-Span', cidocMapping: 'crm:E52_Time-Span', hgCategory: 'temporal' },
  ReligiousTradition: { color: '#a75c82', glowColor: '#d594b4', emoji: '📿', label: 'Religious Tradition', cidocMapping: 'heritageGraph:ReligiousTradition', hgCategory: 'conceptual' },
  SacredSite: { color: '#c6684c', glowColor: '#e8a490', emoji: '🛐', label: 'Sacred Site', cidocMapping: 'hg:SacredSite → heritageGraph:ArchitecturalStructure', hgCategory: 'tangible' },
  Person: { color: '#8b6525', glowColor: '#dfa137', emoji: '👤', label: 'Person', cidocMapping: 'crm:E21_Person', hgCategory: 'actor' },
  Guthi: { color: '#956d28', glowColor: '#e0a743', emoji: '👥', label: 'Guthi', cidocMapping: 'heritageGraph:Guthi', hgCategory: 'actor' },
  IconographicObject: { color: '#ca7156', glowColor: '#ebae9b', emoji: '🖼', label: 'Iconographic Object', cidocMapping: 'heritageGraph:IconographicObject', hgCategory: 'tangible' },
  HistoricalPeriod: { color: '#8c6f4f', glowColor: '#c8a379', emoji: '⏳', label: 'Historical Period', cidocMapping: 'heritageGraph:HistoricalPeriod', hgCategory: 'temporal' },
  Source: { color: '#726c5e', glowColor: '#b3a383', emoji: '📚', label: 'Source', cidocMapping: 'hg:Source → heritageGraph:InformationObject', hgCategory: 'provenance' },
  HistoricalEvent: { color: '#ae6029', glowColor: '#e89255', emoji: '📅', label: 'Historical Event', cidocMapping: 'heritageGraph:HistoricalEvent', hgCategory: 'event' },
  RitualEvent: { color: '#b9662b', glowColor: '#e99a61', emoji: '🕉', label: 'Ritual', cidocMapping: 'heritageGraph:RitualEvent', hgCategory: 'event' },
  CasteGroup: { color: '#9f742a', glowColor: '#e2ab4d', emoji: '👪', label: 'Caste Group', cidocMapping: 'heritageGraph:CasteGroup', hgCategory: 'actor' },
  LivingGoddessTenure: { color: '#957654', glowColor: '#ccaa83', emoji: '👑', label: 'Living Goddess Tenure', cidocMapping: 'crm:E4_Period', hgCategory: 'temporal' },
  SyncreticRelationship: { color: '#ac6689', glowColor: '#d99fbc', emoji: '🔗', label: 'Syncretic Link', cidocMapping: 'heritageGraph:SyncreticRelationship', hgCategory: 'conceptual' },
  HumanMadeObject: { color: '#a54f34', glowColor: '#df7e60', emoji: '🏺', label: 'Human-Made Object', cidocMapping: 'crm:E22_Human-Made_Object', hgCategory: 'tangible' },
  Group: { color: '#a87a2d', glowColor: '#e4b057', emoji: '👥', label: 'Group', cidocMapping: 'crm:E74_Group', hgCategory: 'actor' },
  Set: { color: '#7b7365', glowColor: '#b9aa8d', emoji: '🗂', label: 'Set / Collection', cidocMapping: 'la:Set', hgCategory: 'provenance' },
};

/** Ontology class IRI (rdf:type in the Oxigraph public graph) → canonical NodeType. */
export const RDF_CLASS_URI_TO_NODE_TYPE: Record<string, NodeType> = {
  "http://www.cidoc-crm.org/cidoc-crm/E21_Person": "Person",
  "http://www.cidoc-crm.org/cidoc-crm/E22_Human-Made_Object": "HumanMadeObject",
  "http://www.cidoc-crm.org/cidoc-crm/E4_Period": "LivingGoddessTenure",
  "http://www.cidoc-crm.org/cidoc-crm/E52_Time-Span": "TimeSpan",
  "http://www.cidoc-crm.org/cidoc-crm/E53_Place": "Place",
  "http://www.cidoc-crm.org/cidoc-crm/E74_Group": "Group",
  "https://linked.art/ns/terms/Set": "Set",
  "https://w3id.org/heritagegraph/ArchitecturalStructure": "ArchitecturalStructure",
  "https://w3id.org/heritagegraph/BuddhistMonument": "BuddhistMonument",
  "https://w3id.org/heritagegraph/CasteGroup": "CasteGroup",
  "https://w3id.org/heritagegraph/Deity": "Deity",
  "https://w3id.org/heritagegraph/Festival": "Festival",
  "https://w3id.org/heritagegraph/Guthi": "Guthi",
  "https://w3id.org/heritagegraph/HistoricalEvent": "HistoricalEvent",
  "https://w3id.org/heritagegraph/HistoricalPeriod": "HistoricalPeriod",
  "https://w3id.org/heritagegraph/IconographicObject": "IconographicObject",
  "https://w3id.org/heritagegraph/InformationObject": "Source",
  "https://w3id.org/heritagegraph/ReligiousTradition": "ReligiousTradition",
  "https://w3id.org/heritagegraph/RitualEvent": "RitualEvent",
  "https://w3id.org/heritagegraph/SyncreticRelationship": "SyncreticRelationship",
  "https://w3id.org/heritagegraph/Temple": "Temple",
};

/**
 * Human-readable labels for edge predicates in the graph visualization.
 * Slot URIs are resolved from ontology/HeritageGraph.yaml slots section.
 */
export const RELATION_LABELS: Record<string, string> = {
  has_current_location: 'has current location',  // crm:P55_has_current_location
  is_component_of: 'is component of',  // crm:P46i_forms_part_of
  associated_with: 'associated with',  // heritageGraph:associated_with
  invokes_deity: 'invokes deity',  // heritageGraph:invokesDeity
  took_place_at: 'took place at',  // crm:P7_took_place_at
  was_produced_by_event: 'was produced by event',  // crm:P108i_was_produced_by
  was_derived_from_source: 'was derived from source',  // prov:wasDerivedFrom
  has_component: 'has component',  // crm:P46_is_composed_of
  carried_out_by: 'carried out by',  // crm:P14_carried_out_by
  located_at: 'located at',  // crm:P53_has_former_or_current_location
  co_located: 'co-located with',  // heritageGraph:co_located
  mentions: 'mentions',  // heritageGraph:mentions
  depicts: 'depicts',  // crm:P138_represents
  manages: 'manages',  // heritageGraph:manages
  tradition: 'tradition',  // heritageGraph:religious_tradition
  style: 'architectural style',  // heritageGraph:architectural_style
  type: 'type',  // crm:P2_has_type
  structure_type: 'structure type',  // heritageGraph:structure_type
  ritual_type: 'ritual type',  // heritageGraph:ritualType
  festival_type: 'festival type',  // heritageGraph:festival_type
  guthi_type: 'guthi type',  // heritageGraph:guthiType
  monument_type: 'monument type',  // heritageGraph:monument_type
  object_type: 'object type',  // heritageGraph:object_type
  event_type: 'event type',  // heritageGraph:event_type
  source_type: 'source type',  // heritageGraph:source_type
  tradition_type: 'tradition type',  // heritageGraph:tradition_type
  occupation: 'occupation',  // heritageGraph:occupation
  performed_by: 'performed by',  // crm:P14_carried_out_by
  technique: 'technique',  // crm:P32_used_general_technique
};

/** Color scheme for each domain category in the legend and cluster view. */
export const HG_CATEGORY_CONFIG: Record<HgCategory, { color: string; border: string; label: string }> = {
  tangible: { color: '#ac5236', border: '#8a3f28', label: 'Tangible Heritage' },
  conceptual: { color: '#9d5579', border: '#7c4260', label: 'Conceptual Entities' },
  event: { color: '#a25926', border: '#82461e', label: 'Events' },
  spatial: { color: '#48755f', border: '#385c4a', label: 'Spatiotemporal' },
  temporal: { color: '#826749', border: '#67523a', label: 'Temporal' },
  actor: { color: '#8b6525', border: '#6f501d', label: 'Actors & Institutions' },
  provenance: { color: '#726c5e', border: '#5a554a', label: 'Provenance' },
};
