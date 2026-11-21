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

/** Append a concrete example to a message when the field provides one. */
function withExample(field: OntologyField, base: string): string {
  return field.example ? `${base} — for example: ${field.example}` : base;
}

/** Human-readable format check (length / numeric range / pattern) for a
 *  non-empty value. Returns an actionable message or null. */
function validateFieldFormat(field: OntologyField, v: unknown): string | null {
  if (field.type === "number" || field.type === "float") {
    const n = typeof v === "number" ? v : Number(String(v));
    if (Number.isNaN(n)) return `${field.label} must be a number`;
    if (field.minimum != null && n < field.minimum)
      return `${field.label} must be at least ${field.minimum}`;
    if (field.maximum != null && n > field.maximum)
      return `${field.label} must be at most ${field.maximum}`;
    return null;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (field.minLength != null && s.length < field.minLength)
      return `${field.label} must be at least ${field.minLength} characters`;
    if (field.maxLength != null && s.length > field.maxLength)
      return `${field.label} must be at most ${field.maxLength} characters`;
    if (field.pattern) {
      try {
        if (!new RegExp(field.pattern).test(s))
          return withExample(field, `${field.label} isn't in the expected format`);
      } catch {
        /* invalid pattern in registry — skip client-side check */
      }
    }
  }
  return null;
}

/** Required + cardinality + format checks derived from the merged ontology registry. */
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
      errors[field.key] = withExample(field, `${field.label} is required`);
    }
  }
  for (const field of ontologyClass.fields) {
    const min = field.minimumCardinality;
    const max = field.maximumCardinality;
    if (min === undefined && max === undefined) continue;
    if (errors[field.key]) continue;
    const n = countItems(field, values[field.key]);
    if (min !== undefined && n < min) {
      errors[field.key] =
        min === 1
          ? `${field.label} is required`
          : `${field.label} needs at least ${min} entries`;
    }
    if (max !== undefined && n > max) {
      errors[field.key] = `${field.label} accepts at most ${max} ${
        max === 1 ? "entry" : "entries"
      }`;
    }
  }
  // Format checks run only on filled fields without an existing error.
  for (const field of ontologyClass.fields) {
    if (errors[field.key]) continue;
    const v = values[field.key];
    if (isEmptyForField(field, v)) continue;
    const msg = validateFieldFormat(field, v);
    if (msg) errors[field.key] = msg;
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
