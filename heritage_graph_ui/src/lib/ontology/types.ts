// =================================================================
// Ontology Type System
// =================================================================
// Core types for the HeritageGraph ontology-driven UI.
// Every form field, table column, and API call is derived from these.
// =================================================================

/** Supported field types in the ontology */
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "boolean"
  | "url"
  | "coordinates"
  | "relation"
  | "float";

/** A single field definition */
export interface OntologyField {
  /** Machine key (matches API field name) */
  key: string;
  /** Human-readable label */
  label: string;
  /** Field input type */
  type: FieldType;
  /** Help text shown below the field */
  description?: string;
  /** Whether the field is required */
  required?: boolean;
  /** For select/multiselect: the enum values */
  options?: { value: string; label: string; description?: string }[];
  /** For relation fields: the related ontology class key */
  relationTo?: string;
  /** For relation fields: the API endpoint to search */
  relationEndpoint?: string;
  /** Whether the field accepts multiple values */
  multivalued?: boolean;
  /** Section/group this field belongs to (for form layout) */
  section?: string;
  /** Display order within section */
  order?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Default value */
  defaultValue?: string | number | boolean;
}

/** Column definition for knowledge data tables */
export interface OntologyColumn {
  /** Field key from the OntologyField */
  key: string;
  /** Column header */
  label: string;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Whether column is visible by default */
  visible?: boolean;
  /** Custom cell format hint */
  format?: "text" | "date" | "badge" | "link" | "list";
}

/** A full ontology class definition */
export interface OntologyClass {
  /** Machine key (e.g., "temple", "person") */
  key: string;
  /** Human-readable name */
  label: string;
  /** Plural label for lists */
  labelPlural: string;
  /** Class description from the ontology */
  description: string;
  /** CIDOC-CRM class URI */
  classUri?: string;
  /** Parent class key (for inheritance) */
  parentClass?: string;
  /** Icon identifier (lucide icon name) */
  icon?: string;
  /** API endpoint path (relative, e.g., "/cidoc/persons/") */
  apiEndpoint: string;
  /** Field definitions for contribute forms */
  fields: OntologyField[];
  /** Column definitions for knowledge tables */
  columns: OntologyColumn[];
  /** Section groupings for form layout */
  sections?: { key: string; label: string; description?: string }[];
  /** Whether this class is a top-level navigable domain */
  navigable?: boolean;
  /** Category grouping for sidebar/nav */
  category?: "tangible" | "conceptual" | "event" | "social" | "spatiotemporal" | "provenance";
}

/** The full ontology registry */
export interface OntologyRegistry {
  /** All registered ontology classes, keyed by class key */
  classes: Record<string, OntologyClass>;
  /** All enum definitions, keyed by enum key */
  enums: Record<string, { value: string; label: string; description?: string }[]>;
}
