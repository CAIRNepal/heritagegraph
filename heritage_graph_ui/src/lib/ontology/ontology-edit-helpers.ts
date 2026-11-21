import type { OntologyClass, OntologyField } from "./types";

function serializeFieldForApi(field: OntologyField, val: unknown): unknown {
  if (field.type === "relation") {
    if (field.multivalued) {
      if (Array.isArray(val)) {
        const parts = val.map((item) => {
          if (item && typeof item === "object" && item !== null && "id" in item) {
            return String((item as { id: unknown }).id);
          }
          return String(item);
        });
        return parts.filter(Boolean).join(", ");
      }
      return val;
    }
    if (val && typeof val === "object" && val !== null && "id" in val) {
      return (val as { id: unknown }).id;
    }
    return val;
  }
  if (field.type === "multiselect" && Array.isArray(val)) {
    return val.join(", ");
  }
  if (field.type === "geo_point" && val && typeof val === "object") {
    const g = val as { lat?: string; lng?: string };
    if (!g.lat?.trim() && !g.lng?.trim()) return undefined;
    return `${g.lat?.trim()}, ${g.lng?.trim()}`;
  }
  return val;
}

/**
 * Map a CIDOC (or view) API record into flat form state for OntologyForm.
 * Skips null/empty values so optional fields do not get fake defaults (FR-003).
 */
export function mapCidocRecordToFormData(
  ontologyClass: OntologyClass,
  record: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of ontologyClass.fields) {
    // Coordinates round-trip through `latitude`/`longitude` (see
    // buildOntologyFormPayload); the slot key itself is not in the response.
    if (field.type === "coordinates" || field.type === "geo_point") {
      const lat = record.latitude;
      const lng = record.longitude;
      if (lat != null && lat !== "" && lng != null && lng !== "") {
        out[field.key] = { lat: String(lat), lng: String(lng) };
        continue;
      }
    }
    const v = record[field.key];
    if (v === undefined || v === null) {
      continue;
    }
    if (v === "" && !field.required) {
      continue;
    }
    if (
      (field.type === "coordinates" || field.type === "geo_point") &&
      typeof v === "string"
    ) {
      out[field.key] = parseCoordinateStringForForm(v);
      continue;
    }
    if (
      (field.type === "coordinates" || field.type === "geo_point") &&
      v &&
      typeof v === "object"
    ) {
      const o = v as { lat?: string; lng?: string };
      out[field.key] = { lat: String(o.lat ?? ""), lng: String(o.lng ?? "") };
      continue;
    }
    if ((field.type === "number" || field.type === "float") && typeof v === "string" && v !== "") {
      const n = field.type === "float" ? parseFloat(v) : parseInt(v, 10);
      if (!Number.isNaN(n)) {
        out[field.key] = n;
      } else {
        out[field.key] = v;
      }
      continue;
    }
    out[field.key] = v;
  }
  return out;
}

function parseCoordinateStringForForm(raw: string): { lat: string; lng: string } {
  const parts = raw.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    return { lat: parts[0] ?? "", lng: parts[1] ?? "" };
  }
  return { lat: "", lng: "" };
}

/** Build a JSON body for create (POST) or update (PATCH) from current form data. */
export function buildOntologyFormPayload(
  fields: readonly OntologyField[],
  formData: Record<string, unknown>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const val = formData[field.key];
    if (val === undefined || val === null || val === "") {
      continue;
    }
    if (Array.isArray(val) && val.length === 0) {
      continue;
    }
    if (
      (field.type === "coordinates" || field.type === "geo_point") &&
      typeof val === "object" &&
      val !== null
    ) {
      const c = val as { lat?: string; lng?: string };
      if (!c.lat && !c.lng) {
        continue;
      }
      // The API's coordinate contract is the `latitude`/`longitude` pair: the
      // CIDOC serializers fold it into the `point` column and read it back out
      // the same way. Posting the slot key instead (e.g. `place_coordinates`)
      // lands in the legacy text column at best, and is rejected under PostGIS.
      payload.latitude = c.lat ?? "";
      payload.longitude = c.lng ?? "";
    } else {
      const serialized = serializeFieldForApi(field, val);
      if (serialized === undefined || serialized === null || serialized === "") {
        continue;
      }
      payload[field.key] = serialized;
    }
  }
  return payload;
}
