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
    { key: "affiliations", label: "Affiliations" },
  ],
  fields: [
    nameField("Full Name"),
    { key: "description", label: "Biography", type: "textarea", section: "basic", order: 2, description: "Brief biography" },
    { key: "birth_date", label: "Birth Date", type: "text", section: "life", order: 1, placeholder: "e.g., 1200 CE or c. 1150 CE", description: "Birth date or approximate period" },
    { key: "death_date", label: "Death Date", type: "text", section: "life", order: 2, placeholder: "e.g., 1280 CE", description: "Death date or approximate period" },
    { key: "occupation", label: "Occupation", type: "text", section: "basic", order: 3, placeholder: "e.g., Sculptor, Priest, King", description: "Comma-separated roles" },
    { key: "period", label: "Historical Period", type: "text", section: "life", order: 3, placeholder: "e.g., Malla Period", description: "Historical period of activity" },
    { key: "institutional_affiliation", label: "Institutional Affiliation", type: "text", section: "affiliations", order: 1, description: "e.g., Tribhuvan University" },
    { key: "expertise_area", label: "Areas of Expertise", type: "text", section: "affiliations", order: 2, placeholder: "Comma-separated", description: "e.g., Lichhavi inscriptions, Sanskrit epigraphy" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "occupation", label: "Occupation", sortable: true, visible: true },
    { key: "birth_date", label: "Born", sortable: true, visible: true, format: "text" },
    { key: "death_date", label: "Died", sortable: true, visible: true, format: "text" },
    { key: "period", label: "Period", sortable: true, visible: true, format: "badge" },
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
    { key: "location_type", label: "Place Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.LocationTypeEnum, description: "Type of place" },
    { key: "coordinates", label: "Coordinates", type: "coordinates", section: "geography", order: 1, placeholder: "Lat, Long", description: "GPS coordinates (latitude, longitude)" },
    { key: "period", label: "Historical Period", type: "text", section: "basic", order: 4, placeholder: "e.g., Lichhavi Period" },
    { key: "condition_status", label: "Condition Status", type: "select", section: "basic", order: 5, options: [
      { value: "preserved", label: "Preserved" },
      { value: "partially_ruined", label: "Partially Ruined" },
      { value: "ruined", label: "Ruined" },
      { value: "rebuilt", label: "Rebuilt" },
    ]},
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "location_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "coordinates", label: "Coordinates", visible: true },
    { key: "condition_status", label: "Status", sortable: true, visible: true, format: "badge" },
    { key: "period", label: "Period", sortable: true, visible: true },
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
    { key: "participation", label: "Participation" },
  ],
  fields: [
    nameField("Event Name"),
    descriptionField(),
    { key: "event_type", label: "Event Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.EventTypeEnum, description: "Classification of event" },
    { key: "start_date", label: "Start Date", type: "text", section: "temporal", order: 1, placeholder: "e.g., 2024-01-15 or c. 1200 CE", description: "Start date or earliest date" },
    { key: "end_date", label: "End Date", type: "text", section: "temporal", order: 2, placeholder: "e.g., 2024-01-20", description: "End date or latest date" },
    { key: "recurrence", label: "Recurrence", type: "select", section: "temporal", order: 3, options: ontologyEnums.RecurrenceEnum, description: "Frequency of event" },
    { key: "participants", label: "Participants", type: "text", section: "participation", order: 1, placeholder: "Comma-separated names", description: "Key participants in the event" },
    { key: "location_name", label: "Location", type: "text", section: "basic", order: 4, description: "Where the event takes place" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "event_type", label: "Type", sortable: true, visible: true, format: "badge" },
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
    { key: "tradition_type", label: "Category", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.TraditionCategoryEnum, description: "Type of tradition" },
    { key: "region", label: "Region", type: "text", section: "practice", order: 1, placeholder: "e.g., Kathmandu Valley", description: "Geographic region where practiced" },
    { key: "practitioners", label: "Practitioners", type: "text", section: "practice", order: 2, placeholder: "e.g., Newar community", description: "Communities or groups that practice this tradition" },
    noteField(),
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "tradition_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "region", label: "Region", sortable: true, visible: true },
    { key: "practitioners", label: "Practitioners", visible: true },
  ],
};

const source: OntologyClass = {
  key: "source",
  label: "Source",
  labelPlural: "Sources",
  description: "Original source from which heritage information was derived",
  classUri: "crm:E73_Information_Object",
  icon: "book-open",
  apiEndpoint: "/cidoc/sources/",
  category: "provenance",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "publication", label: "Publication Details" },
    { key: "access", label: "Access & Location" },
  ],
  fields: [
    { key: "title", label: "Title", type: "text", required: true, section: "basic", order: 1, description: "Title of the source" },
    { key: "author", label: "Author(s)", type: "text", section: "basic", order: 2, placeholder: "Comma-separated", description: "Author name(s)" },
    { key: "source_type", label: "Source Type", type: "select", section: "basic", order: 3, required: true, options: ontologyEnums.SourceTypeEnum, description: "Type of source material" },
    { key: "year", label: "Publication Year", type: "text", section: "publication", order: 1, placeholder: "e.g., 2020", description: "Year of publication" },
    { key: "publisher", label: "Publisher", type: "text", section: "publication", order: 2, description: "Publishing entity" },
    { key: "url", label: "URL", type: "url", section: "access", order: 1, placeholder: "https://...", description: "Digital location of source" },
    { key: "citation", label: "Citation", type: "textarea", section: "access", order: 2, description: "Formal citation text" },
    noteField(),
  ],
  columns: [
    { key: "title", label: "Title", sortable: true, visible: true },
    { key: "author", label: "Author", sortable: true, visible: true },
    { key: "source_type", label: "Type", sortable: true, visible: true, format: "badge" },
    { key: "year", label: "Year", sortable: true, visible: true },
    { key: "url", label: "URL", visible: false, format: "link" },
  ],
};

// -----------------------------------------------------------------
// NEW ONTOLOGY CLASSES — from HeritageGraph.yaml
// -----------------------------------------------------------------

const deity: OntologyClass = {
  key: "deity",
  label: "Deity",
  labelPlural: "Deities",
  description: "Divine conceptual entity in Hindu, Buddhist, or syncretic traditions",
  classUri: "crm:E28_Conceptual_Object",
  icon: "sparkles",
  apiEndpoint: "/cidoc/deities/",
  category: "conceptual",
  navigable: true,
  sections: [
    { key: "basic", label: "Basic Information" },
    { key: "tradition", label: "Religious Context" },
  ],
  fields: [
    nameField("Deity Name"),
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 2, description: "Description of the deity" },
    { key: "religious_tradition", label: "Religious Tradition", type: "text", section: "tradition", order: 1, placeholder: "e.g., Hindu, Buddhist, Syncretic", description: "Tradition(s) in which this deity is venerated" },
    { key: "alternate_names", label: "Alternate Names", type: "text", section: "basic", order: 3, placeholder: "Comma-separated", description: "Other names or epithets" },
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
    { key: "structure_type", label: "Structure Type", type: "select", section: "basic", order: 3, required: true, options: [
      { value: "Temple", label: "Temple" },
      { value: "Stupa", label: "Stupa" },
      { value: "Chaitya", label: "Chaitya" },
      { value: "Pati", label: "Pati (Open Pavilion)" },
      { value: "Sattal", label: "Sattal (Multi-story Rest House)" },
      { value: "Dharmashala", label: "Dharmashala (Pilgrim Lodge)" },
      { value: "DhungeDhara", label: "Dhunge Dhara (Stone Spout)" },
      { value: "Pokhari", label: "Pokhari (Pond/Tank)" },
      { value: "Other", label: "Other" },
    ], description: "Type of architectural structure" },
    { key: "architectural_style", label: "Architectural Style", type: "select", section: "architecture", order: 1, options: ontologyEnums.ArchitecturalStyleEnum },
    { key: "construction_date", label: "Construction Date", type: "text", section: "architecture", order: 2, placeholder: "e.g., c. 1637 CE", description: "Date or period of construction" },
    { key: "location_name", label: "Location", type: "text", section: "location", order: 1, placeholder: "e.g., Kathmandu Durbar Square", description: "Current location" },
    { key: "coordinates", label: "Coordinates", type: "coordinates", section: "location", order: 2, placeholder: "Lat, Long" },
    { key: "existence_status", label: "Existence Status", type: "select", section: "status", order: 1, options: ontologyEnums.ExistenceStatusEnum },
    { key: "condition", label: "Condition", type: "select", section: "status", order: 2, options: ontologyEnums.ConditionTypeEnum },
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
    { key: "festival_type", label: "Festival Type", type: "select", section: "basic", order: 3, options: [
      { value: "ChariotFestival", label: "Chariot Festival (Rath Jatra)" },
      { value: "MaskedDance", label: "Masked Dance Festival" },
      { value: "Jatra", label: "General Jatra" },
      { value: "Other", label: "Other" },
    ]},
    { key: "date", label: "Date / Season", type: "text", section: "temporal", order: 1, placeholder: "e.g., Baisakh, Annual" },
    { key: "duration", label: "Duration", type: "text", section: "temporal", order: 2, placeholder: "e.g., 3 days, 1 month" },
    { key: "location_name", label: "Location", type: "text", section: "basic", order: 4 },
    { key: "route_description", label: "Procession Route", type: "textarea", section: "route", order: 1 },
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
    { key: "object_type", label: "Object Type", type: "select", section: "basic", order: 3, required: true, options: [
      { value: "Paubha", label: "Paubha (Scroll Painting)" },
      { value: "Murti", label: "Murti (Consecrated Statue)" },
      { value: "Other", label: "Other Iconographic Object" },
    ]},
    { key: "depicts_deity", label: "Depicts Deity", type: "text", section: "details", order: 1, description: "Deity depicted in this object" },
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
    { key: "monument_type", label: "Type", type: "select", section: "basic", order: 3, required: true, options: [
      { value: "Stupa", label: "Stupa" },
      { value: "Chaitya", label: "Chaitya" },
      { value: "Other", label: "Other Buddhist Monument" },
    ]},
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
