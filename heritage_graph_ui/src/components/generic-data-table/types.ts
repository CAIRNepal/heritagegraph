import { ColumnDef } from '@tanstack/react-table';

/**
 * One tab in a filterable tab strip (e.g. All / Pending / Approved).
 * Omit `filter` for an "All" tab that shows every row.
 */
export interface DataTableTab<TData> {
  id: string;
  label: string;
  filter?: (row: TData) => boolean;
}

/**
 * Configuration for a data table instance.
 * This interface allows the GenericDataTable to be fully customizable
 * for different data types (persons, locations, events, etc.)
 */
export interface DataTableConfig<TData> {
  /** API endpoint to fetch data from (relative to NEXT_PUBLIC_API_URL) */
  endpoint: string;
  /** Column definitions for the table */
  columns: ColumnDef<TData>[];
  /** Key to extract data array from API response (e.g., "persons", "results") */
  dataKey?: string;
  /** Base path for viewing individual items (e.g., "/knowledge/person") */
  viewBasePath?: string;
  /**
   * Unique row id for selection, pagination, and drag-drop (TanStack `getRowId`).
   * Defaults to numeric/string `id`. Use `entity_id` for cultural entities.
   */
  rowIdField?: keyof TData;
  /** @deprecated Use `rowIdField` */
  idField?: keyof TData;
  /** Title to display in the table header */
  title?: string;
  /** Description to display below title */
  description?: string;
  /** Whether to show the header section (title, description, add button) */
  showHeader?: boolean;
  /**
   * Tab definitions. Set to `false` to hide tabs.
   * If omitted and `showTabs` is not false, default status workflow tabs are used.
   */
  tabs?: false | DataTableTab<TData>[];
  /** Initial tab id when using tabs (default: first tab, usually `all`) */
  defaultTabId?: string;
  /** Whether to show tabs (legacy). Prefer `tabs: false` to disable. */
  showTabs?: boolean;
  /** Custom empty state message */
  emptyMessage?: string;
  /** Whether to enable drag-and-drop reordering */
  enableDragDrop?: boolean;
  /** Whether to enable row selection */
  enableSelection?: boolean;
  /** Whether to enable column filters */
  enableFilters?: boolean;
  /** Custom action for "Add" button */
  addAction?: {
    label: string;
    href: string;
  };
}

/**
 * Base record type with common fields
 */
export interface BaseRecord {
  id: number | string;
  title?: string;
  name?: string;
  description?: string;
  contributor?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Person record type
 */
export interface PersonRecord extends BaseRecord {
  aliases?: string;
  birth_date?: string;
  death_date?: string;
  occupation?: string;
  biography?: string;
  cultural_entity_id?: string;
}

/**
 * Location record type
 */
export interface LocationRecord extends BaseRecord {
  coordinates?: string;
  type?: string;
  current_status?: string;
  cultural_entity_id?: string;
}

/**
 * Event record type
 */
export interface EventRecord extends BaseRecord {
  event_type?: string;
  start_date?: string;
  end_date?: string;
  recurrence?: string;
  cultural_entity_id?: string;
}

/**
 * Tradition record type
 */
export interface TraditionRecord extends BaseRecord {
  tradition_type?: string;
  region?: string;
  cultural_entity_id?: string;
}

/**
 * Cultural Entity record type
 */
export interface CulturalEntityRecord {
  entity_id: string;
  name: string;
  category: string;
  status: string;
  created_at: string;
  updated_at?: string;
  contributor?: { username?: string; id?: number };
  current_revision?: Record<string, unknown>;
}

/**
 * Source record type — aligns with `cidoc_data.Source` + CulturalEntityLinkMixin
 */
export interface SourceRecord extends BaseRecord {
  authors?: string;
  publication_year?: string;
  /** Material type: book, journal, archive, thesis, web, field_note */
  type?: string;
  digital_link?: string;
  archive_location?: string;
  cultural_entity_id?: string | null;
}

/**
 * Historical Period record type
 */
export interface HistoricalPeriodRecord extends BaseRecord {
  start_year?: string;
  end_year?: string;
  cultural_entity_id?: string;
}

/**
 * Deity record type
 */
export interface DeityRecord extends BaseRecord {
  religious_tradition?: string;
  alternate_names?: string;
  note?: string;
}

/**
 * Guthi record type
 */
export interface GuthiRecord extends BaseRecord {
  guthi_type?: string;
  location?: string;
  managed_structures?: string;
  note?: string;
}

/**
 * Architectural Structure record type
 */
export interface StructureRecord extends BaseRecord {
  structure_type?: string;
  architectural_style?: string;
  construction_date?: string;
  location_name?: string;
  coordinates?: string;
  existence_status?: string;
  condition?: string;
  note?: string;
}

/**
 * Ritual Event record type
 */
export interface RitualRecord extends BaseRecord {
  ritual_type?: string;
  date?: string;
  recurrence_pattern?: string;
  performed_by?: string;
  location_name?: string;
  note?: string;
}

/**
 * Festival record type
 */
export interface FestivalRecord extends BaseRecord {
  festival_type?: string;
  date?: string;
  duration?: string;
  location_name?: string;
  note?: string;
}

/**
 * Iconographic Object record type
 */
export interface IconographyRecord extends BaseRecord {
  object_type?: string;
  depicts_deity?: string;
  creation_date?: string;
  technique?: string;
  location_name?: string;
  note?: string;
}

/**
 * Monument record type
 */
export interface MonumentRecord extends BaseRecord {
  monument_type?: string;
  construction_date?: string;
  location_name?: string;
  coordinates?: string;
  existence_status?: string;
  note?: string;
}
