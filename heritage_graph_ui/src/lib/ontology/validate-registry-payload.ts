/**
 * Lightweight client-side checks against `registry_jsonschema` (MT1).
 * Uses required/properties from the generated bundle; extend with Ajv if you add `ajv` + `ajv-formats`.
 */
import type { RegistryJsonSchemaBlob } from "./types";

export function validatePayloadAgainstRegistrySchema(
  blob: RegistryJsonSchemaBlob | undefined,
  classKey: string,
  payload: Record<string, unknown>
): string[] {
  if (!blob?.byClassKey) return [];
  const schema = blob.byClassKey[classKey] as {
    required?: string[];
    properties?: Record<string, unknown>;
  };
  if (!schema || typeof schema !== "object") return [];
  const errors: string[] = [];
  const req = schema.required || [];
  for (const key of req) {
    const v = payload[key];
    if (v === undefined || v === null || v === "") {
      errors.push(`"${key}" is required`);
    } else if (Array.isArray(v) && v.length === 0) {
      errors.push(`"${key}" is required`);
    }
  }
  return errors;
}
