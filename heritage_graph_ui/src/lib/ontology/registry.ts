// =================================================================
// Ontology Registry — Single Source of Truth
// =================================================================
// Maps every HeritageGraph ontology class to its fields, columns,
// API endpoint, and UI metadata. Add new ontology classes here and
// the contribute forms + knowledge tables auto-generate.
// =================================================================

import type { OntologyClass } from "./types";
import { ontologyEnums } from "./enums";

// -----------------------------------------------------------------
// HELPER: common field templates
// -----------------------------------------------------------------
const nameField = (label = "Name") => ({
  key: "name",
  label,
  type: "text" as const,
  required: true,
  description: "Primary name or label",
  section: "basic",
  order: 1,
});

const noteField = () => ({
  key: "note",
  label: "Notes",
  type: "textarea" as const,
  description: "Free-text description or notes",
  section: "basic",
  order: 10,
});

const descriptionField = () => ({
  key: "description",
  label: "Description",
  type: "textarea" as const,
  description: "Detailed description",
  section: "basic",
  order: 5,
});

// -----------------------------------------------------------------
// ONTOLOGY CLASSES
// -----------------------------------------------------------------

const person: OntologyClass = {
  key: "person",
  label: "Person",
  labelPlural: "Persons",
  description: "Individual who performs, commissions, documents, or verifies heritage activities",
  classUri: "crm:E21_Person",
  icon: "user",
  apiEndpoint: "/cidoc/persons/",
  category: "social",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "life", label: "Life Details" },
  ],
  fields: [
    nameField("Full Name"),
    { key: "description", label: "Biography", type: "textarea", section: "basic", order: 2, description: "Brief biography" },
    { key: "birth_date", label: "Birth Date", type: "text", section: "life", order: 1, placeholder: "e.g., 1200 CE or c. 1150 CE", description: "Birth date or approximate period" },
    { key: "death_date", label: "Death Date", type: "text", section: "life", order: 2, placeholder: "e.g., 1280 CE", description: "Death date or approximate period" },
    { key: "occupation", label: "Occupation", type: "text", section: "basic", order: 3, placeholder: "e.g., Sculptor, Priest, King", description: "Comma-separated roles" },
    { key: "aliases", label: "Alternative Names", type: "text", section: "basic", order: 4, placeholder: "Comma-separated", description: "Alternative names or aliases" },
    { key: "biography", label: "Biography", type: "textarea", section: "life", order: 3, description: "Detailed biography" },
    { key: "institutional_affiliation", label: "Institutional Affiliation", type: "text", section: "basic", order: 5, placeholder: "e.g., Tribhuvan University, Nepal Heritage Society", description: "Current or former institutional affiliation" },
    { key: "expertise_area", label: "Areas of Expertise", type: "text", section: "basic", order: 6, placeholder: "Comma-separated, e.g., Lichhavi inscriptions, Sanskrit epigraphy", description: "Domains of expertise" },
    { key: "member_of_group", label: "Member of Group", type: "relation", section: "life", order: 4, relationTo: "guthi", relationEndpoint: "/cidoc/guthis/", description: "Groups this person belongs to" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "occupation", label: "Occupation", sortable: true, visible: true },
    { key: "birth_date", label: "Born", sortable: true, visible: true, format: "text" },
    { key: "death_date", label: "Died", sortable: true, visible: true, format: "text" },
    { key: "institutional_affiliation", label: "Affiliation", sortable: true, visible: false },
    { key: "aliases", label: "Aliases", sortable: false, visible: false },
  ],
};

const location: OntologyClass = {
  key: "location",
  label: "Place",
  labelPlural: "Places",
  description: "Defined geographic location where events occur and structures exist",
  classUri: "crm:E53_Place",
  icon: "map-pin",
  apiEndpoint: "/cidoc/locations/",
  category: "spatiotemporal",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "geography", label: "Geography" },
  ],
  fields: [
    nameField("Place Name"),
    descriptionField(),
    { key: "type", label: "Place Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.LocationTypeEnum, description: "Type of place" },
    { key: "coordinates", label: "Coordinates", type: "coordinates", section: "geography", order: 1, placeholder: "Lat, Long", description: "GPS coordinates (latitude, longitude)" },
    { key: "current_status", label: "Condition Status", type: "select", section: "basic", order: 5, required: true, options: [
      { value: "preserved", label: "Preserved" },
      { value: "partially_ruined", label: "Partially Ruined" },
      { value: "ruined", label: "Ruined" },
      { value: "rebuilt", label: "Rebuilt" },
    ]},
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "coordinates", label: "Coordinates", visible: true },
    { key: "current_status", label: "Status", sortable: true, visible: true, format: "badge" },
  ],
};

const event: OntologyClass = {
  key: "event",
  label: "Event",
  labelPlural: "Events",
  description: "Major event affecting heritage structures or ritual life",
  classUri: "crm:E5_Event",
  icon: "calendar",
  apiEndpoint: "/cidoc/events/",
  category: "event",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "temporal", label: "Temporal Details" },
  ],
  fields: [
    nameField("Event Name"),
    descriptionField(),
    { key: "type", label: "Event Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.EventTypeEnum, description: "Classification of event" },
    { key: "start_date", label: "Start Date", type: "text", section: "temporal", order: 1, placeholder: "e.g., 2024-01-15 or c. 1200 CE", description: "Start date or earliest date" },
    { key: "end_date", label: "End Date", type: "text", section: "temporal", order: 2, placeholder: "e.g., 2024-01-20", description: "End date or latest date" },
    { key: "recurrence", label: "Recurrence", type: "select", section: "temporal", order: 3, required: true, options: ontologyEnums.RecurrenceEnum, description: "Frequency of event" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "start_date", label: "Start", sortable: true, visible: true },
    { key: "end_date", label: "End", sortable: true, visible: true },
    { key: "recurrence", label: "Recurrence", sortable: true, visible: true, format: "badge" },
  ],
};

const historicalPeriod: OntologyClass = {
  key: "period",
  label: "Historical Period",
  labelPlural: "Historical Periods",
  description: "A defined historical time period",
  classUri: "crm:E4_Period",
  icon: "clock",
  apiEndpoint: "/cidoc/historical_periods/",
  category: "spatiotemporal",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "temporal", label: "Temporal Extent" },
  ],
  fields: [
    nameField("Period Name"),
    descriptionField(),
    { key: "approximate_date", label: "Approximate Date", type: "text", section: "temporal", order: 1, placeholder: "e.g., c. 1200 BCE", description: "Approximate date string" },
    { key: "start_year", label: "Start Year", type: "number", section: "temporal", order: 2, description: "Numeric start year" },
    { key: "end_year", label: "End Year", type: "number", section: "temporal", order: 3, description: "Numeric end year" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "approximate_date", label: "Date", sortable: true, visible: true },
    { key: "start_year", label: "From", sortable: true, visible: true },
    { key: "end_year", label: "To", sortable: true, visible: true },
    { key: "description", label: "Description", visible: true },
  ],
};

const tradition: OntologyClass = {
  key: "tradition",
  label: "Tradition",
  labelPlural: "Traditions",
  description: "Cultural tradition or practice (ritual, dance, music, craft, storytelling)",
  classUri: "crm:E55_Type",
  icon: "flame",
  apiEndpoint: "/cidoc/traditions/",
  category: "conceptual",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "practice", label: "Practice Details" },
  ],
  fields: [
    nameField("Tradition Name"),
    descriptionField(),
    { key: "type", label: "Category", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.TraditionCategoryEnum, description: "Type of tradition" },
    { key: "associated_materials", label: "Associated Materials", type: "text", section: "practice", order: 1, placeholder: "e.g., Tools, garments, instruments", description: "Tools, garments, instruments used" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "associated_materials", label: "Materials", sortable: true, visible: true },
  ],
};

const source: OntologyClass = {
  key: "source",
  label: "Source",
  labelPlural: "Sources",
  description: "Original source from which heritage information was derived (CIDOC E73 + DataCite)",
  classUri: "crm:E73_Information_Object",
  icon: "book-open",
  apiEndpoint: "/cidoc/sources/",
  category: "provenance",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "publication", label: "Publication Details" },
    { key: "identifier", label: "Identifier & Type" },
    { key: "access", label: "Access & Location" },
  ],
  fields: [
    { key: "title", label: "Title", type: "text", required: true, section: "basic", order: 1, description: "Title of the source" },
    { key: "authors", label: "Author(s)", type: "text", required: true, section: "basic", order: 2, placeholder: "Comma-separated", description: "Author name(s)" },
    { key: "type", label: "Source Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.SourceTypeEnum, description: "Type of source material" },
    { key: "publication_year", label: "Publication Year", type: "text", section: "publication", order: 1, placeholder: "e.g., 2020", description: "Year of publication" },
    { key: "source_language", label: "Language", type: "text", section: "publication", order: 2, placeholder: "e.g., Nepali, Sanskrit, English", description: "Language of the source material" },
    { key: "datacite_identifier", label: "Persistent Identifier", type: "text", section: "identifier", order: 1, placeholder: "e.g., 10.1234/hg.2024", description: "DOI, ISBN, Handle, or archive ID" },
    { key: "datacite_identifier_type", label: "Identifier Type", type: "select", section: "identifier", order: 2, options: ontologyEnums.IdentifierTypeEnum, description: "Type of persistent identifier" },
    { key: "datacite_resource_type", label: "Resource Type", type: "select", section: "identifier", order: 3, options: ontologyEnums.DataCiteResourceTypeEnum, description: "DataCite resource classification" },
    { key: "digital_link", label: "URL", type: "url", section: "access", order: 1, placeholder: "https://...", description: "Digital location of source" },
    { key: "archive_location", label: "Archive Location", type: "text", section: "access", order: 2, placeholder: "e.g., Nepal National Archives", description: "Physical archive location" },
    { key: "source_citation", label: "Full Citation", type: "textarea", section: "publication", order: 3, description: "Formal bibliographic citation" },
    noteField(),
  ],
  columns: [
    { key: "title", label: "Title", sortable: true, visible: true },
    { key: "authors", label: "Author", sortable: true, visible: true },
    { key: "type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "publication_year", label: "Year", sortable: true, visible: true },
    { key: "datacite_identifier", label: "ID", visible: false },
    { key: "digital_link", label: "URL", visible: false, format: "link" },
  ],
};

// -----------------------------------------------------------------
// NEW ONTOLOGY CLASSES — from HeritageGraph.yaml
// -----------------------------------------------------------------

const deity: OntologyClass = {
  key: "deity",
  label: "Deity",
  labelPlural: "Deities",
  description: "Divine conceptual entity in Hindu, Buddhist, or syncretic traditions. Distinct from physical representations (Murti) and ritual presences.",
  classUri: "crm:E28_Conceptual_Object",
  icon: "sparkles",
  apiEndpoint: "/cidoc/deities/",
  category: "conceptual",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "tradition", label: "Religious Context" },
    { key: "relationships", label: "Relationships" },
  ],
  fields: [
    nameField("Deity Name"),
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 2, description: "Description of the deity" },
    { key: "religious_tradition", label: "Religious Tradition", type: "select", section: "tradition", order: 1, options: ontologyEnums.ReligiousTraditionEnum, description: "Tradition(s) in which this deity is venerated" },
    { key: "alternate_names", label: "Alternate Names", type: "text", section: "basic", order: 3, placeholder: "Comma-separated", description: "Other names or epithets" },
    { key: "is_depicted_in", label: "Depicted In", type: "relation", section: "relationships", order: 1, relationTo: "iconography", relationEndpoint: "/cidoc/iconographic_objects/", description: "Iconographic objects depicting this deity" },
    { key: "is_enshrined_through_event", label: "Enshrined Through", type: "relation", section: "relationships", order: 2, relationTo: "enshrinement", description: "Enshrinement events for this deity" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "religious_tradition", label: "Tradition", sortable: true, visible: true, format: "badge" },
    { key: "description", label: "Description", visible: true },
  ],
};

const guthi: OntologyClass = {
  key: "guthi",
  label: "Guthi",
  labelPlural: "Guthis",
  description: "Endowed trust organization managing temples, rituals, and land",
  classUri: "crm:E74_Group",
  icon: "users",
  apiEndpoint: "/cidoc/guthis/",
  category: "social",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "function", label: "Function & Membership" },
  ],
  fields: [
    nameField("Guthi Name"),
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 2 },
    { key: "guthi_type", label: "Guthi Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.GuthiTypeEnum, description: "Functional type of Guthi" },
    { key: "location", label: "Location", type: "text", section: "basic", order: 4, placeholder: "e.g., Patan, Bhaktapur", description: "Where this Guthi operates" },
    { key: "managed_structures", label: "Managed Structures", type: "text", section: "function", order: 1, placeholder: "Comma-separated", description: "Temples/structures under management" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "guthi_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "location", label: "Location", sortable: true, visible: true },
  ],
};

const architecturalStructure: OntologyClass = {
  key: "structure",
  label: "Architectural Structure",
  labelPlural: "Architectural Structures",
  description: "Physical structures built for religious, social, or civic purposes",
  classUri: "crm:E22_Human-Made_Object",
  icon: "landmark",
  apiEndpoint: "/cidoc/structures/",
  category: "tangible",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "architecture", label: "Architecture" },
    { key: "status", label: "Status & Condition" },
    { key: "location", label: "Location" },
  ],
  fields: [
    nameField("Structure Name"),
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 2 },
    { key: "structure_type", label: "Structure Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.StructureTypeEnum, description: "Type of architectural structure" },
    { key: "architectural_style", label: "Architectural Style", type: "select", section: "architecture", order: 1, options: ontologyEnums.ArchitecturalStyleEnum },
    { key: "construction_date", label: "Construction Date", type: "text", section: "architecture", order: 2, placeholder: "e.g., c. 1637 CE", description: "Date or period of construction" },
    { key: "location_name", label: "Location", type: "text", section: "location", order: 1, placeholder: "e.g., Kathmandu Durbar Square", description: "Current location" },
    { key: "coordinates", label: "Coordinates", type: "coordinates", section: "location", order: 2, placeholder: "Lat, Long" },
    { key: "existence_status", label: "Existence Status", type: "select", section: "status", order: 1, options: ontologyEnums.ExistenceStatusEnum },
    { key: "condition", label: "Condition", type: "select", section: "status", order: 2, options: ontologyEnums.ConditionTypeEnum },
    { key: "last_known_existence_date", label: "Last Known Existence Date", type: "date", section: "status", order: 3, description: "Latest date when structure is documented as existing" },
    { key: "enshrines_deity_through_event", label: "Enshrined Deities", type: "relation", section: "architecture", order: 3, relationTo: "deity", relationEndpoint: "/cidoc/deities/", multivalued: true, description: "Deities enshrined in this structure" },
    { key: "managed_by_guthi", label: "Managed By Guthi", type: "relation", section: "basic", order: 6, relationTo: "guthi", relationEndpoint: "/cidoc/guthis/", multivalued: true, description: "Guthi organizations managing this structure" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "structure_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "architectural_style", label: "Style", sortable: true, visible: true, format: "badge" },
    { key: "location_name", label: "Location", sortable: true, visible: true },
    { key: "existence_status", label: "Status", sortable: true, visible: true, format: "badge" },
  ],
};

const ritualEvent: OntologyClass = {
  key: "ritual",
  label: "Ritual Event",
  labelPlural: "Ritual Events",
  description: "Intentional ritual activity that activates sacred space, invokes deities, and binds social groups",
  classUri: "crm:E7_Activity",
  icon: "flame-kindling",
  apiEndpoint: "/cidoc/rituals/",
  category: "event",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "temporal", label: "Timing" },
    { key: "participation", label: "Participation" },
    { key: "route", label: "Procession Route" },
  ],
  fields: [
    nameField("Ritual Name"),
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 2 },
    { key: "ritual_type", label: "Ritual Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.RitualTypeEnum },
    { key: "date", label: "Date", type: "text", section: "temporal", order: 1, placeholder: "e.g., Chaitra Shukla Ashtami" },
    { key: "recurrence_pattern", label: "Recurrence", type: "text", section: "temporal", order: 2, placeholder: "e.g., Annual, Monthly" },
    { key: "lunar_date_tithi", label: "Lunar Tithi", type: "text", section: "temporal", order: 3, placeholder: "e.g., Purnima" },
    { key: "performed_by", label: "Performed By", type: "text", section: "participation", order: 1, placeholder: "Groups or individuals" },
    { key: "invokes_deity", label: "Invokes Deity", type: "relation", section: "participation", order: 2, relationTo: "deity", relationEndpoint: "/cidoc/deities/", multivalued: true, description: "Deity invoked or made present through ritual" },
    { key: "performed_by_group", label: "Performing Group", type: "relation", section: "participation", order: 3, relationTo: "guthi", relationEndpoint: "/cidoc/guthis/", multivalued: true, description: "Guthi or caste group responsible" },
    { key: "ritual_on_structure", label: "At Structure", type: "relation", section: "participation", order: 4, relationTo: "structure", relationEndpoint: "/cidoc/structures/", description: "Structure where ritual occurs" },
    { key: "is_part_of_festival", label: "Part of Festival", type: "relation", section: "basic", order: 5, relationTo: "festival", relationEndpoint: "/cidoc/festivals/", description: "Larger festival this ritual is part of" },
    { key: "used_materials", label: "Materials Used", type: "text", section: "participation", order: 5, placeholder: "e.g., oil, rice, flowers", description: "Ephemeral materials consumed during the ritual" },
    { key: "location_name", label: "Location", type: "text", section: "basic", order: 4 },
    { key: "route_description", label: "Route Description", type: "textarea", section: "route", order: 1, description: "Describe the procession route" },
    { key: "start_place", label: "Starting Place", type: "text", section: "route", order: 2 },
    { key: "end_place", label: "Ending Place", type: "text", section: "route", order: 3 },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "ritual_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "recurrence_pattern", label: "Recurrence", visible: true },
    { key: "location_name", label: "Location", sortable: true, visible: true },
  ],
};

const festival: OntologyClass = {
  key: "festival",
  label: "Festival",
  labelPlural: "Festivals",
  description: "Large-scale community ritual event (Jatra) involving processions, music, and collective participation",
  classUri: "crm:E7_Activity",
  parentClass: "ritual",
  icon: "party-popper",
  apiEndpoint: "/cidoc/festivals/",
  category: "event",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "temporal", label: "Timing" },
    { key: "route", label: "Procession Route" },
  ],
  fields: [
    nameField("Festival Name"),
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 2 },
    { key: "festival_type", label: "Festival Type", type: "select", section: "basic", order: 3, options: ontologyEnums.FestivalTypeEnum },
    { key: "date", label: "Date / Season", type: "text", section: "temporal", order: 1, placeholder: "e.g., Baisakh, Annual" },
    { key: "duration", label: "Duration", type: "text", section: "temporal", order: 2, placeholder: "e.g., 3 days, 1 month" },
    { key: "location_name", label: "Location", type: "text", section: "basic", order: 4 },
    { key: "route_description", label: "Procession Route", type: "textarea", section: "route", order: 1 },
    { key: "includes_ritual_event", label: "Component Rituals", type: "relation", section: "basic", order: 5, relationTo: "ritual", relationEndpoint: "/cidoc/rituals/", multivalued: true, description: "Ritual events that compose this festival" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "festival_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "date", label: "Date", sortable: true, visible: true },
    { key: "location_name", label: "Location", sortable: true, visible: true },
  ],
};

const iconographicObject: OntologyClass = {
  key: "iconography",
  label: "Iconographic Object",
  labelPlural: "Iconographic Objects",
  description: "Sacred visual art objects (Paubha, Murti) that depict or embody deities",
  classUri: "crm:E22_Human-Made_Object",
  icon: "image",
  apiEndpoint: "/cidoc/iconographic_objects/",
  category: "tangible",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "details", label: "Iconographic Details" },
    { key: "location", label: "Location" },
  ],
  fields: [
    nameField("Object Name"),
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 2 },
    { key: "object_type", label: "Object Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.IconographicObjectTypeEnum },
    { key: "depicts_deity", label: "Depicts Deity", type: "relation", section: "details", order: 1, relationTo: "deity", relationEndpoint: "/cidoc/deities/", multivalued: true, description: "Deity depicted iconographically" },
    { key: "creation_date", label: "Creation Date", type: "text", section: "details", order: 2, placeholder: "e.g., c. 1500 CE" },
    { key: "technique", label: "Technique/Medium", type: "text", section: "details", order: 3, placeholder: "e.g., Tempera on cloth" },
    { key: "location_name", label: "Current Location", type: "text", section: "location", order: 1 },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "object_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "depicts_deity", label: "Deity", sortable: true, visible: true },
    { key: "location_name", label: "Location", sortable: true, visible: true },
  ],
};

const monument: OntologyClass = {
  key: "monument",
  label: "Monument",
  labelPlural: "Monuments",
  description: "Buddhist sacred structures (Stupa, Chaitya) with ritual significance",
  classUri: "heritageGraph:BuddhistMonument",
  parentClass: "structure",
  icon: "mountain",
  apiEndpoint: "/cidoc/monuments/",
  category: "tangible",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "location", label: "Location" },
    { key: "status", label: "Status" },
  ],
  fields: [
    nameField("Monument Name"),
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 2 },
    { key: "monument_type", label: "Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.MonumentTypeEnum },
    { key: "construction_date", label: "Construction Date", type: "text", section: "basic", order: 4, placeholder: "e.g., c. 600 CE" },
    { key: "location_name", label: "Location", type: "text", section: "location", order: 1 },
    { key: "coordinates", label: "Coordinates", type: "coordinates", section: "location", order: 2, placeholder: "Lat, Long" },
    { key: "existence_status", label: "Existence Status", type: "select", section: "status", order: 1, options: ontologyEnums.ExistenceStatusEnum },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "monument_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "location_name", label: "Location", sortable: true, visible: true },
    { key: "existence_status", label: "Status", sortable: true, visible: true, format: "badge" },
  ],
};

// -----------------------------------------------------------------
// REGISTRY EXPORT
// -----------------------------------------------------------------

// -----------------------------------------------------------------
// ADDITIONAL ONTOLOGY CLASSES — from HeritageGraph.yaml
// -----------------------------------------------------------------

const calendarSystem: OntologyClass = {
  key: "calendar",
  label: "Calendar System",
  labelPlural: "Calendar Systems",
  description: "Calendar reckoning system with conversion rules for multi-calendar temporal reasoning (e.g., Bikram Sambat, Nepal Sambat)",
  classUri: "time:Calendar",
  icon: "calendar-clock",
  apiEndpoint: "/cidoc/calendar_systems/",
  category: "spatiotemporal",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "conversion", label: "Conversion Rules" },
    { key: "usage", label: "Usage" },
  ],
  fields: [
    nameField("Calendar Name"),
    { key: "epoch_date_gregorian", label: "Epoch Date (Gregorian)", type: "text", section: "conversion", order: 1, placeholder: "e.g., 0057-01-01", description: "Start date of this calendar era in Gregorian ISO format" },
    { key: "year_offset_from_gregorian", label: "Year Offset from Gregorian", type: "number", section: "conversion", order: 2, placeholder: "e.g., 57", description: "Mathematical offset to convert to Common Era (e.g., +57 for BS)" },
    { key: "is_primary_for_tradition", label: "Primary for Tradition", type: "select", section: "usage", order: 1, options: ontologyEnums.ReligiousTraditionEnum, description: "Religious tradition that primarily uses this calendar" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "year_offset_from_gregorian", label: "Year Offset", sortable: true, visible: true },
    { key: "is_primary_for_tradition", label: "Primary Tradition", sortable: true, visible: true, format: "badge" },
  ],
};

const syncreticRelationship: OntologyClass = {
  key: "syncretism",
  label: "Syncretic Relationship",
  labelPlural: "Syncretic Relationships",
  description: "Formalizes syncretic equivalence between divine entities across different theological frameworks, treated as propositional claim with epistemic authority",
  classUri: "crm:E13_Attribute_Assignment",
  icon: "git-merge",
  apiEndpoint: "/cidoc/syncretic_relationships/",
  category: "conceptual",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "deities", label: "Deity Mapping" },
    { key: "provenance", label: "Provenance" },
  ],
  fields: [
    nameField("Relationship Name"),
    { key: "assigned_to_deity", label: "Primary Deity", type: "relation", section: "deities", order: 1, required: true, relationTo: "deity", relationEndpoint: "/cidoc/deities/", description: "The deity that is the subject of the syncretic claim" },
    { key: "assigned_equivalent", label: "Equivalent Deity", type: "relation", section: "deities", order: 2, required: true, relationTo: "deity", relationEndpoint: "/cidoc/deities/", multivalued: true, description: "The deity identified as equivalent" },
    { key: "syncretic_type", label: "Syncretism Type", type: "select", section: "basic", order: 2, required: true, options: ontologyEnums.SyncreticTypeEnum, description: "Nature of the syncretism" },
    { key: "documented_in_source", label: "Source", type: "relation", section: "provenance", order: 1, relationTo: "source", relationEndpoint: "/cidoc/sources/", description: "Source documenting this syncretic claim" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "syncretic_type", label: "Type", sortable: true, visible: true, format: "badge" },
  ],
};

const livingGoddessTenure: OntologyClass = {
  key: "kumari_tenure",
  label: "Living Goddess Tenure",
  labelPlural: "Living Goddess Tenures",
  description: "Time-bounded role where a person embodies a deity as Living Goddess (Kumari), residing at a specific god-house",
  classUri: "crm:E4_Period",
  icon: "crown",
  apiEndpoint: "/cidoc/kumari_tenures/",
  category: "event",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "participants", label: "Participants & Deity" },
    { key: "temporal", label: "Temporal Extent" },
    { key: "support", label: "Institutional Support" },
  ],
  fields: [
    nameField("Tenure Name"),
    { key: "had_participant", label: "Living Goddess (Person)", type: "relation", section: "participants", order: 1, required: true, relationTo: "person", relationEndpoint: "/cidoc/persons/", description: "The girl serving as Living Goddess" },
    { key: "embodied_deity", label: "Embodied Deity", type: "relation", section: "participants", order: 2, required: true, relationTo: "deity", relationEndpoint: "/cidoc/deities/", description: "Deity believed to be present in this person" },
    { key: "residence_structure", label: "Residence (God-House)", type: "relation", section: "participants", order: 3, required: true, relationTo: "structure", relationEndpoint: "/cidoc/structures/", description: "God-house where Living Goddess resides (e.g., Kumari Ghar)" },
    { key: "date_earliest", label: "Start Date", type: "date", section: "temporal", order: 1, description: "Selection date" },
    { key: "date_latest", label: "End Date", type: "date", section: "temporal", order: 2, description: "Retirement date" },
    { key: "supported_by_institution", label: "Supporting Guthi", type: "relation", section: "support", order: 1, relationTo: "guthi", relationEndpoint: "/cidoc/guthis/", multivalued: true, description: "Guthi providing economic/ritual support" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "date_earliest", label: "From", sortable: true, visible: true, format: "date" },
    { key: "date_latest", label: "To", sortable: true, visible: true, format: "date" },
  ],
};

const livingGoddessSelection: OntologyClass = {
  key: "kumari_selection",
  label: "Living Goddess Selection",
  labelPlural: "Living Goddess Selections",
  description: "Tantric ritual process of selecting a new Living Goddess from eligible candidates, involving examination of 32 lakshana and tests of fearlessness",
  classUri: "heritageGraph:LivingGoddessSelection",
  parentClass: "ritual",
  icon: "scan-search",
  apiEndpoint: "/cidoc/kumari_selections/",
  category: "event",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "selection", label: "Selection Details" },
    { key: "temporal", label: "When & Where" },
  ],
  fields: [
    nameField("Selection Event Name"),
    { key: "selected_person", label: "Selected Person", type: "relation", section: "selection", order: 1, required: true, relationTo: "person", relationEndpoint: "/cidoc/persons/", description: "Girl selected to become Living Goddess" },
    { key: "initiated_tenure", label: "Initiated Tenure", type: "relation", section: "selection", order: 2, required: true, relationTo: "kumari_tenure", relationEndpoint: "/cidoc/kumari_tenures/", description: "Tenure that this selection initiated" },
    { key: "selection_criteria_met", label: "Selection Criteria Met", type: "textarea", section: "selection", order: 3, placeholder: "e.g., 32 lakshana present, horoscope compatible...", description: "List of selection criteria verified" },
    { key: "date_earliest", label: "Date", type: "date", section: "temporal", order: 1 },
    { key: "took_place_at", label: "Location", type: "relation", section: "temporal", order: 2, relationTo: "location", relationEndpoint: "/cidoc/locations/", description: "Where the selection occurred" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "date_earliest", label: "Date", sortable: true, visible: true, format: "date" },
  ],
};

const livingGoddessRetirement: OntologyClass = {
  key: "kumari_retirement",
  label: "Living Goddess Retirement",
  labelPlural: "Living Goddess Retirements",
  description: "Ritual event that formally ends a Living Goddess tenure, marking the person's return to secular status",
  classUri: "heritageGraph:LivingGoddessRetirement",
  parentClass: "ritual",
  icon: "log-out",
  apiEndpoint: "/cidoc/kumari_retirements/",
  category: "event",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "details", label: "Retirement Details" },
    { key: "temporal", label: "When & Where" },
  ],
  fields: [
    nameField("Retirement Event Name"),
    { key: "ended_tenure_of", label: "Ended Tenure", type: "relation", section: "details", order: 1, required: true, relationTo: "kumari_tenure", relationEndpoint: "/cidoc/kumari_tenures/", description: "The tenure that this event terminated" },
    { key: "carried_out_by", label: "Conducted By", type: "text", section: "details", order: 2, placeholder: "Priests or officials", description: "Who performed the retirement ritual" },
    { key: "date_earliest", label: "Date", type: "date", section: "temporal", order: 1 },
    { key: "took_place_at", label: "Location", type: "relation", section: "temporal", order: 2, relationTo: "location", relationEndpoint: "/cidoc/locations/", description: "Where the retirement ceremony occurred" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "date_earliest", label: "Date", sortable: true, visible: true, format: "date" },
  ],
};

const documentationActivity: OntologyClass = {
  key: "documentation",
  label: "Documentation Activity",
  labelPlural: "Documentation Activities",
  description: "The process of recording information about a heritage entity, aligning CIDOC E13 with PROV-O Activity",
  classUri: "crm:E7_Activity",
  icon: "clipboard-list",
  apiEndpoint: "/cidoc/documentation_activities/",
  category: "provenance",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "subject", label: "Subject" },
    { key: "method", label: "Method & Equipment" },
    { key: "temporal", label: "When" },
  ],
  fields: [
    nameField("Activity Name"),
    { key: "subject_entity", label: "Subject Entity", type: "relation", section: "subject", order: 1, relationTo: "structure", relationEndpoint: "/cidoc/structures/", multivalued: true, description: "Heritage entity being documented" },
    { key: "subject_event", label: "Subject Event", type: "relation", section: "subject", order: 2, relationTo: "ritual", relationEndpoint: "/cidoc/rituals/", multivalued: true, description: "Event being documented" },
    { key: "performed_by_agent", label: "Performed By", type: "relation", section: "basic", order: 2, relationTo: "person", relationEndpoint: "/cidoc/persons/", multivalued: true, description: "Person who performed the documentation" },
    { key: "used_method", label: "Method", type: "select", section: "method", order: 1, options: ontologyEnums.DocumentationMethodEnum, description: "Documentation method used" },
    { key: "used_equipment", label: "Equipment", type: "text", section: "method", order: 2, placeholder: "e.g., DSLR Camera, Total Station, Voice Recorder", description: "Equipment used" },
    { key: "date_earliest", label: "Date", type: "date", section: "temporal", order: 1 },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "used_method", label: "Method", sortable: true, visible: true, format: "badge" },
    { key: "date_earliest", label: "Date", sortable: true, visible: true, format: "date" },
  ],
};

const material: OntologyClass = {
  key: "material",
  label: "Material",
  labelPlural: "Materials",
  description: "Physical substance used in construction, crafting, or ritual",
  classUri: "crm:E57_Material",
  icon: "layers",
  apiEndpoint: "/cidoc/materials/",
  category: "tangible",
  navigable: false,
  sections: [{ key: "basic", label: "Basic Information" }],
  fields: [
    nameField("Material Name"),
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
  ],
};

const technique: OntologyClass = {
  key: "technique",
  label: "Technique",
  labelPlural: "Techniques",
  description: "Method or craft process used in production or ritual",
  classUri: "crm:E29_Design_or_Procedure",
  icon: "hammer",
  apiEndpoint: "/cidoc/techniques/",
  category: "tangible",
  navigable: false,
  sections: [{ key: "basic", label: "Basic Information" }],
  fields: [
    nameField("Technique Name"),
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
  ],
};

const religiousTradition: OntologyClass = {
  key: "religious_tradition",
  label: "Religious Tradition",
  labelPlural: "Religious Traditions",
  description: "Religious or philosophical tradition (e.g., Hindu, Buddhist, Syncretic)",
  classUri: "crm:E55_Type",
  icon: "book-heart",
  apiEndpoint: "/cidoc/traditions/",
  category: "conceptual",
  navigable: false,
  sections: [{ key: "basic", label: "Basic Information" }],
  fields: [
    nameField("Tradition Name"),
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
  ],
};

const casteGroup: OntologyClass = {
  key: "caste_group",
  label: "Caste Group",
  labelPlural: "Caste Groups",
  description: "Hereditary social group (Jati) with specific ritual roles and occupational duties",
  classUri: "crm:E74_Group",
  icon: "users-round",
  apiEndpoint: "/cidoc/caste_groups/",
  category: "social",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "role", label: "Traditional Role" },
  ],
  fields: [
    nameField("Caste Group Name"),
    { key: "traditional_role", label: "Traditional Role", type: "text", section: "role", order: 1, placeholder: "e.g., Vajracharya (priestly), Shakya (goldsmith)", description: "Hereditary occupation or ritual duty" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "traditional_role", label: "Role", sortable: true, visible: true },
  ],
};

const heritageAssertion: OntologyClass = {
  key: "assertion",
  label: "Heritage Assertion",
  labelPlural: "Heritage Assertions",
  description: "A single factual claim about a heritage entity, with explicit source, author, date, and confidence (PROV-O + CRMinf)",
  classUri: "crminf:I2_Belief",
  icon: "shield-check",
  apiEndpoint: "/cidoc/assertions/",
  category: "provenance",
  navigable: true,
  sections: [
    { key: "basic", label: "Assertion Content" },
    { key: "about", label: "About" },
    { key: "provenance", label: "Provenance" },
    { key: "quality", label: "Quality & Reconciliation" },
  ],
  fields: [
    { key: "assertion_content", label: "Assertion", type: "textarea", section: "basic", order: 1, required: true, description: "The factual claim being asserted" },
    { key: "asserted_property", label: "Property", type: "text", section: "basic", order: 2, required: true, placeholder: "e.g., existence_status, construction_date", description: "Property or attribute name" },
    { key: "asserted_value", label: "Value", type: "text", section: "basic", order: 3, required: true, placeholder: "e.g., Lost, 598 CE", description: "The value claimed for this property" },
    { key: "was_derived_from_source", label: "Source", type: "relation", section: "provenance", order: 1, relationTo: "source", relationEndpoint: "/cidoc/sources/", multivalued: true, description: "Source(s) this assertion derives from" },
    { key: "was_attributed_to_agent", label: "Attributed To", type: "relation", section: "provenance", order: 2, relationTo: "person", relationEndpoint: "/cidoc/persons/", multivalued: true, description: "Person who made this assertion" },
    { key: "confidence_score", label: "Confidence (0–1)", type: "float", section: "quality", order: 1, placeholder: "e.g., 0.85", description: "Reliability score (0.0–1.0)" },
    { key: "data_quality_note", label: "Quality Note", type: "textarea", section: "quality", order: 2, description: "Notes on data quality or uncertainty" },
    { key: "reconciliation_status", label: "Reconciliation Status", type: "select", section: "quality", order: 3, options: [
      { value: "confirmed", label: "Confirmed" },
      { value: "conflicting", label: "Conflicting" },
      { value: "unverified", label: "Unverified" },
    ], description: "Status of multi-source reconciliation" },
  ],
  columns: [
    { key: "asserted_property", label: "Property", sortable: true, visible: true },
    { key: "asserted_value", label: "Value", sortable: true, visible: true },
    { key: "confidence_score", label: "Confidence", sortable: true, visible: true },
    { key: "reconciliation_status", label: "Status", sortable: true, visible: true, format: "badge" },
  ],
};

// -----------------------------------------------------------------
// CULTURAL ENTITY (Generic contributed entities)
// -----------------------------------------------------------------
const culturalEntity: OntologyClass = {
  key: "entity",
  label: "Cultural Entity",
  labelPlural: "Cultural Entities",
  description: "Contributed cultural entities — monuments, festivals, rituals, traditions, and artifacts",
  classUri: "heritageGraph:CulturalEntity",
  icon: "landmark",
  apiEndpoint: "/data/api/cultural-entities/",
  category: "tangible",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
  ],
  fields: [
    { key: "name", label: "Name", type: "text", required: true, section: "basic", order: 1 },
    { key: "category", label: "Category", type: "select", section: "basic", order: 2, options: [
      { value: "monument", label: "Monument" },
      { value: "artifact", label: "Artifact" },
      { value: "ritual", label: "Ritual" },
      { value: "festival", label: "Festival" },
      { value: "tradition", label: "Tradition" },
      { value: "document", label: "Document" },
      { value: "other", label: "Other" },
    ]},
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 3 },
    { key: "status", label: "Status", type: "text", section: "basic", order: 4 },
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "category", label: "Category", sortable: true, visible: true, format: "badge" },
    { key: "status", label: "Status", sortable: true, visible: true, format: "badge" },
    { key: "description", label: "Description", visible: true },
  ],
};

/** All registered ontology classes */
export const ontologyClasses: Record<string, OntologyClass> = {
  person,
  location,
  event,
  period: historicalPeriod,
  tradition,
  source,
  deity,
  guthi,
  structure: architecturalStructure,
  ritual: ritualEvent,
  festival,
  iconography: iconographicObject,
  monument,
  // Generic cultural entity for contributions
  entity: culturalEntity,
  // New ontology-aligned classes
  calendar: calendarSystem,
  syncretism: syncreticRelationship,
  kumari_tenure: livingGoddessTenure,
  kumari_selection: livingGoddessSelection,
  kumari_retirement: livingGoddessRetirement,
  documentation: documentationActivity,
  material,
  technique,
  religious_tradition: religiousTradition,
  caste_group: casteGroup,
  assertion: heritageAssertion,
};

/** Get a class definition by its key */
export function getOntologyClass(key: string): OntologyClass | undefined {
  return ontologyClasses[key];
}

/** Get all navigable (top-level) classes */
export function getNavigableClasses(): OntologyClass[] {
  return Object.values(ontologyClasses).filter((c) => c.navigable);
}

/** Get all classes grouped by category */
export function getClassesByCategory(): Record<string, OntologyClass[]> {
  const grouped: Record<string, OntologyClass[]> = {};
  for (const cls of Object.values(ontologyClasses)) {
    const cat = cls.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(cls);
  }
  return grouped;
}

/** Category metadata for UI display */
export const categoryMeta: Record<string, { label: string; icon: string }> = {
  tangible: { label: "Tangible Heritage", icon: "landmark" },
  conceptual: { label: "Conceptual Entities", icon: "lightbulb" },
  event: { label: "Events & Rituals", icon: "calendar" },
  social: { label: "Social Organizations", icon: "users" },
  spatiotemporal: { label: "Spaces & Time", icon: "map" },
  provenance: { label: "Sources & Provenance", icon: "book-open" },
};
