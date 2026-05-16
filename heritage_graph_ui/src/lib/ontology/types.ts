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
  | "edtf_date"
  | "geo_point"
  | "select"
  | "multiselect"
  | "boolean"
  | "url"
  | "coordinates"
  | "relation"
  | "float"
  | "media";

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
  options?: readonly { readonly value: string; readonly label: string; readonly description?: string }[];
  /** For relation fields: the related ontology class key */
  relationTo?: string;
  /** For relation fields: the API endpoint to search */
  relationEndpoint?: string;
  /** UI registry key for the related class (LinkML class → tools/ui-classmap.yaml) */
  relationRegistryKey?: string;
  /** When true, contribute form may open a nested create panel for this relation */
  inlineAuthoring?: boolean;
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
  /** RDF slot URI from LinkML (overlay from schema API / generator) */
  slot_uri?: string;
  /** LinkML enum name when type is select and options were inlined from registry enums */
  enum_range?: string;
  /** From LinkML slot_usage / slot (when present) */
  minimumCardinality?: number;
  maximumCardinality?: number;
  /** Optional weight (1–10) for completeness score on non-required fields */
  ui_weight?: number;
  /** JSON Schema string pattern (from LinkML / ui-presentation) */
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  /** Merged into generated JSON Schema for this property */
  jsonSchemaExtras?: Record<string, unknown>;
}

/** One row from tools/contribute-hub.yaml `hubCategories` */
export interface ContributeHubCategoryRow {
  key: string;
  label: string;
  icon: string;
  order?: number;
}

/** One row from tools/contribute-hub.yaml `intents` */
export interface ContributeHubIntentRow {
  registryKey: string;
  hubCategory: string;
  route: string;
  emoji: string;
  shortDescription: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

/** Contribute landing metadata from tools/contribute-hub.yaml */
export interface ContributeHubPayload {
  hubCategories: ContributeHubCategoryRow[];
  intents: ContributeHubIntentRow[];
  quickStart: string[];
}

/** One guided step inside a semantic workflow pattern (ResearchSpace-style template). */
export interface SemanticPatternStep {
  readonly order: number;
  readonly title: string;
  readonly detail?: string;
  readonly ctaRoute: string;
  readonly ctaLabel: string;
  /** Appended as query string after `?` when opening the step CTA. */
  readonly linkQuery?: string;
}

/** Guided multi-form workflow surfaced on the contribute hub and /contribute/pattern/[slug]. */
export interface SemanticPattern {
  readonly key: string;
  readonly userLabel: string;
  readonly userDescription?: string;
  readonly hubCategory?: string;
  readonly emoji?: string;
  readonly difficulty?: string;
  readonly journey?: string;
  readonly steps: readonly SemanticPatternStep[];
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
  category?:
    | "tangible"
    | "conceptual"
    | "event"
    | "social"
    | "spatiotemporal"
    | "provenance"
    | "kumari";
}

/** Generated JSON Schemas per class key (MT1) */
export interface RegistryJsonSchemaBlob {
  version: number;
  byClassKey: Record<string, Record<string, unknown>>;
}

/** The full ontology registry */
export interface OntologyRegistry {
  /** Schema API hash / version string */
  schema_version?: string;
  /** All registered ontology classes, keyed by class key */
  classes: Record<string, OntologyClass>;
  /** All enum definitions, keyed by enum key */
  enums: Record<
    string,
    readonly { readonly value: string; readonly label: string; readonly description?: string }[]
  >;
  /** Contribute dashboard copy and grouping (from tools/contribute-hub.yaml) */
  contribute_hub?: ContributeHubPayload;
  /** Semantic workflows (multi-step graph-oriented authoring shells). */
  semantic_patterns?: readonly SemanticPattern[];
  /** Optional JSON Schema bundle for client-side validation */
  registry_jsonschema?: RegistryJsonSchemaBlob;
}
