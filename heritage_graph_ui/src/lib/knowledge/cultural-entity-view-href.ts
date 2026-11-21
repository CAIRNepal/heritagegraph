/**
 * CulturalEntity revisions from CIDOC creates include `_cidoc_model` and `_cidoc_id`
 * (heritage_graph/apps/cidoc_data/views.py). The list API also includes serialized
 * payload fields such as `id` (same as `_cidoc_id` for AutoField models).
 *
 * Some clients or edge cases may omit `_cidoc_*` or send `data` as a JSON string; we
 * normalize and fall back on `category` + `id` so e.g. document → /knowledge/source/view/{id}.
 */

const CIDOC_MODEL_TO_ONTOLOGY_KEY: Record<string, string> = {
  Person: "person",
  Location: "location",
  Event: "event",
  HistoricalPeriod: "period",
  Tradition: "tradition",
  Source: "source",
  Deity: "deity",
  Guthi: "guthi",
  ArchitecturalStructure: "structure",
  RitualEvent: "ritual",
  Festival: "festival",
  IconographicObject: "iconography",
  Monument: "monument",
  KumariTenure: "kumari_tenure",
  KumariSelection: "kumari_selection",
  KumariRetirement: "kumari_retirement",
  SyncreticRelationship: "syncretism",
  CasteGroup: "caste_group",
  CalendarSystem: "calendar",
  HeritageAssertion: "assertion",
};

function getRevisionData(
  currentRevision?: { data?: unknown } | null,
): Record<string, unknown> | null {
  const raw = currentRevision?.data;
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function recordPk(data: Record<string, unknown>): string | null {
  const v = data._cidoc_id ?? data.id;
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * When `_cidoc_model` is missing, map CulturalEntity.category + revision payload shape
 * to an ontology route (aligned with cidoc_data.views._get_category_for_model).
 */
function inferDomainFromCategory(
  category: string,
  data: Record<string, unknown>,
): string | null {
  const cat = category.trim().toLowerCase().replace(/-/g, "_");
  switch (cat) {
    case "document":
      return "source";
    case "festival":
      return "festival";
    case "tradition":
      if (data.guthi_type != null || data.managed_structures != null) return "guthi";
      return "tradition";
    case "ritual":
      if (data.selected_person != null || data.initiated_tenure != null) return "kumari_selection";
      if (data.ended_tenure_of != null) return "kumari_retirement";
      if (
        data.had_participant != null ||
        data.embodied_deity != null ||
        data.residence_structure != null
      ) {
        return "kumari_tenure";
      }
      return "ritual";
    case "monument":
      if (data.structure_type != null || data.architectural_style != null) return "structure";
      return "monument";
    case "artifact":
      return "iconography";
    case "other":
      if (data.syncretic_type != null || data.assigned_to_deity != null) return "syncretism";
      return null;
    default:
      return null;
  }
}

export function culturalEntityViewHref(
  entityId: string,
  currentRevision?: { data?: unknown } | null,
  category?: string,
): string {
  const data = getRevisionData(currentRevision);
  if (data) {
    const pk = recordPk(data);
    const model = data._cidoc_model;
    if (typeof model === "string" && pk) {
      const domain = CIDOC_MODEL_TO_ONTOLOGY_KEY[model];
      if (domain) {
        return `/knowledge/${domain}/view/${encodeURIComponent(pk)}`;
      }
    }
    if (pk && category) {
      const inferred = inferDomainFromCategory(category, data);
      if (inferred) {
        return `/knowledge/${inferred}/view/${encodeURIComponent(pk)}`;
      }
    }
  }
  return `/knowledge/entity/view/${entityId}`;
}
