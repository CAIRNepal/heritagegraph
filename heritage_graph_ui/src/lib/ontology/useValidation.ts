"use client";

import type { OntologyClass } from "./types";

/** Minimal required-field checks derived from the merged ontology registry. */
export function validateRequiredFields(
  ontologyClass: OntologyClass,
  values: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ontologyClass.fields) {
    if (!field.required) continue;
    const v = values[field.key];
    const empty =
      v === undefined ||
      v === null ||
      (typeof v === "string" && v.trim() === "") ||
      (Array.isArray(v) && v.length === 0);
    if (empty) {
      errors[field.key] = `${field.label} is required`;
    }
  }
  return errors;
}
