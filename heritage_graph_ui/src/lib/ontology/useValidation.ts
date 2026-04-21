"use client";

import type { OntologyClass, OntologyField } from "./types";

function isEmptyForField(field: OntologyField, v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (
    (field.type === "coordinates" || field.type === "geo_point") &&
    v &&
    typeof v === "object"
  ) {
    const o = v as { lat?: unknown; lng?: unknown };
    const lat = String(o.lat ?? "").trim();
    const lng = String(o.lng ?? "").trim();
    return !lat && !lng;
  }
  if (field.type === "geo_point" && typeof v === "string") {
    return v.trim() === "";
  }
  if (field.type === "relation" && !field.multivalued) {
    if (v && typeof v === "object" && "id" in (v as object)) return false;
    if (typeof v === "string" && v.trim() !== "") return false;
    return true;
  }
  if (field.type === "relation" && field.multivalued) {
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "string" && !v.trim()) return true;
    return false;
  }
  return false;
}

/** Exported for completeness meter and other UI that mirrors required-field logic. */
export function isEmptyOntologyFieldValue(field: OntologyField, v: unknown): boolean {
  return isEmptyForField(field, v);
}

function countItems(field: OntologyField, v: unknown): number {
  if (field.type === "multiselect" && Array.isArray(v)) return v.length;
  if (field.type === "relation" && field.multivalued) {
    if (Array.isArray(v)) return v.length;
    if (typeof v === "string" && v.trim())
      return v.split(",").filter(Boolean).length;
    return 0;
  }
  if (v === undefined || v === null) return 0;
  if (typeof v === "string") return v.trim() === "" ? 0 : 1;
  return 1;
}

/** Minimal required-field checks derived from the merged ontology registry. */
export function validateRequiredFields(
  ontologyClass: OntologyClass,
  values: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ontologyClass.fields) {
    if (!field.required) continue;
    const v = values[field.key];
    const empty = isEmptyForField(field, v);
    if (empty) {
      errors[field.key] = `${field.label} is required`;
    }
  }
  for (const field of ontologyClass.fields) {
    const min = field.minimumCardinality;
    const max = field.maximumCardinality;
    if (min === undefined && max === undefined) continue;
    if (errors[field.key]) continue;
    const n = countItems(field, values[field.key]);
    if (min !== undefined && n < min) {
      errors[field.key] = `${field.label} needs at least ${min} value(s)`;
    }
    if (max !== undefined && n > max) {
      errors[field.key] = `${field.label} accepts at most ${max} value(s)`;
    }
  }
  return errors;
}

/** Like `validateRequiredFields`, but only for the given field keys (e.g. one form section). */
export function validateRequiredFieldsForFieldKeys(
  ontologyClass: OntologyClass,
  fieldKeys: readonly string[],
  values: Record<string, unknown>
): Record<string, string> {
  const keySet = new Set(fieldKeys);
  const slim: OntologyClass = {
    ...ontologyClass,
    fields: ontologyClass.fields.filter((f) => keySet.has(f.key)),
  };
  return validateRequiredFields(slim, values);
}
