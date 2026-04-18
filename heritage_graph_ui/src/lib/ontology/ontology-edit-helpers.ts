import type { OntologyClass, OntologyField } from "./types";

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
    const v = record[field.key];
    if (v === undefined || v === null) {
      continue;
    }
    if (v === "" && !field.required) {
      continue;
    }
    if (field.type === "coordinates" && typeof v === "string") {
      out[field.key] = parseCoordinateStringForForm(v);
      continue;
    }
    if (field.type === "coordinates" && v && typeof v === "object") {
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
    if (field.type === "coordinates" && typeof val === "object" && val !== null) {
      const c = val as { lat?: string; lng?: string };
      if (!c.lat && !c.lng) {
        continue;
      }
      payload[field.key] = `${c.lat}, ${c.lng}`;
    } else {
      payload[field.key] = val;
    }
  }
  return payload;
}
