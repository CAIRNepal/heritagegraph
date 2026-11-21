/**
 * Client-side validation against `registry_jsonschema` (MT1) using Ajv draft 2020-12.
 */
import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject } from "ajv";
import type { RegistryJsonSchemaBlob } from "./types";

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  allowUnionTypes: true,
});

/**
 * Returns field-keyed error messages (first error per top-level property).
 * Use key `__non_field__` for schema-level messages without an instance path.
 */
export function validatePayloadAgainstRegistrySchema(
  blob: RegistryJsonSchemaBlob | undefined,
  classKey: string,
  payload: Record<string, unknown>
): Record<string, string> {
  if (!blob?.byClassKey) return {};
  const schema = blob.byClassKey[classKey];
  if (!schema || typeof schema !== "object") return {};

  let validate: ReturnType<typeof ajv.compile>;
  try {
    validate = ajv.compile(schema as object);
  } catch {
    return { __non_field__: "Invalid schema bundle for this class." };
  }

  const ok = validate(payload);
  if (ok) return {};

  const out: Record<string, string> = {};
  for (const err of (validate.errors || []) as ErrorObject[]) {
    const bits = (err.instancePath || "")
      .replace(/^\//, "")
      .split("/")
      .filter(Boolean);
    const top = bits[0];
    const key = top || "__non_field__";
    const msg = (err.message || "Invalid value").trim();
    const detail = top ? msg : msg;
    if (!out[key]) {
      out[key] = bits.length > 1 ? `${bits.join(".")}: ${detail}` : detail;
    }
  }
  return out;
}
