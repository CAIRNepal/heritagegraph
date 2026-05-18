// AUTO-GENERATED — do not edit by hand.
// Source:  ontology/HeritageGraph.yaml + tools/ui-vizmap.yaml
// Regen:   python3 tools/gen_heritage_viz_config.py
// Hash:    abee1dcfecf75531
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
  | 'HistoricalEvent';

export type HgCategory = 'tangible' | 'conceptual' | 'event' | 'spatial' | 'temporal' | 'actor' | 'provenance';

/** Visual configuration for each NodeType in the force-directed graph. */
export const NODE_TYPE_CONFIG: Record<
  NodeType,
  { color: string; glowColor: string; emoji: string; label: string; cidocMapping: string; hgCategory: string }
> = {
  Place: { color: '#10b981', glowColor: '#34d399', emoji: '🏔', label: 'Place', cidocMapping: 'crm:E53_Place', hgCategory: 'spatial' },
  Temple: { color: '#f59e0b', glowColor: '#fcd34d', emoji: '🛕', label: 'Temple', cidocMapping: 'heritageGraph:Temple', hgCategory: 'tangible' },
  BuddhistMonument: { color: '#8b5cf6', glowColor: '#a78bfa', emoji: '☸', label: 'Buddhist Monument', cidocMapping: 'heritageGraph:BuddhistMonument', hgCategory: 'tangible' },
  ArchitecturalStructure: { color: '#ec4899', glowColor: '#f472b6', emoji: '🏛', label: 'Architectural Structure', cidocMapping: 'heritageGraph:ArchitecturalStructure', hgCategory: 'tangible' },
  Settlement: { color: '#06b6d4', glowColor: '#22d3ee', emoji: '🏙', label: 'Settlement', cidocMapping: 'hg:Settlement → crm:E53_Place', hgCategory: 'spatial' },
  Deity: { color: '#ef4444', glowColor: '#f87171', emoji: '✨', label: 'Deity', cidocMapping: 'crm:E28_Conceptual_Object', hgCategory: 'conceptual' },
  Festival: { color: '#f97316', glowColor: '#fb923c', emoji: '🎉', label: 'Festival', cidocMapping: 'heritageGraph:Festival', hgCategory: 'event' },
  TimeSpan: { color: '#6366f1', glowColor: '#818cf8', emoji: '📜', label: 'Time-Span', cidocMapping: 'crm:E52_Time-Span', hgCategory: 'temporal' },
  ReligiousTradition: { color: '#14b8a6', glowColor: '#2dd4bf', emoji: '🎨', label: 'Religious Tradition', cidocMapping: 'crm:E55_Type', hgCategory: 'conceptual' },
  SacredSite: { color: '#84cc16', glowColor: '#a3e635', emoji: '🌿', label: 'Sacred Site', cidocMapping: 'hg:SacredSite → heritageGraph:ArchitecturalStructure', hgCategory: 'tangible' },
  Person: { color: '#22c55e', glowColor: '#86efac', emoji: '👤', label: 'Person', cidocMapping: 'crm:E21_Person', hgCategory: 'actor' },
  Guthi: { color: '#0ea5e9', glowColor: '#7dd3fc', emoji: '🏘', label: 'Guthi', cidocMapping: 'heritageGraph:Guthi', hgCategory: 'actor' },
  IconographicObject: { color: '#d946ef', glowColor: '#f0abfc', emoji: '🖼', label: 'Iconographic Object', cidocMapping: 'heritageGraph:IconographicObject', hgCategory: 'tangible' },
  HistoricalPeriod: { color: '#a3a3a3', glowColor: '#d4d4d4', emoji: '⏳', label: 'Historical Period', cidocMapping: 'hg:HistoricalPeriod → crm:E52_Time-Span', hgCategory: 'temporal' },
  Source: { color: '#78716c', glowColor: '#a8a29e', emoji: '📚', label: 'Source', cidocMapping: 'hg:Source → heritageGraph:DataSource', hgCategory: 'provenance' },
  HistoricalEvent: { color: '#facc15', glowColor: '#fde68a', emoji: '📅', label: 'Historical Event', cidocMapping: 'crm:E5_Event', hgCategory: 'event' },
};

/**
 * Human-readable labels for edge predicates in the graph visualization.
 * Slot URIs are resolved from ontology/HeritageGraph.yaml slots section.
 */
export const RELATION_LABELS: Record<string, string> = {
  has_current_location: 'has current location',  // crm:P55_has_current_location
  is_component_of: 'is component of',  // crm:P46i_forms_part_of
  associated_with: 'associated with',  // heritageGraph:associated_with
  invokes_deity: 'invokes deity',  // heritageGraph:invokes_deity
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
  ritual_type: 'ritual type',  // heritageGraph:ritual_type
  festival_type: 'festival type',  // heritageGraph:festival_type
  guthi_type: 'guthi type',  // heritageGraph:guthi_type
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
  tangible: { color: '#3b82f6', border: '#2563eb', label: 'Tangible Heritage' },
  conceptual: { color: '#8b5cf6', border: '#7c3aed', label: 'Conceptual Entities' },
  event: { color: '#f59e0b', border: '#d97706', label: 'Events' },
  spatial: { color: '#06b6d4', border: '#0891b2', label: 'Spatiotemporal' },
  temporal: { color: '#6366f1', border: '#4f46e5', label: 'Temporal' },
  actor: { color: '#22c55e', border: '#15803d', label: 'Actors & Institutions' },
  provenance: { color: '#78716c', border: '#57534e', label: 'Provenance' },
};
