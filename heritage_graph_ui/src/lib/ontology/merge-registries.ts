import type { OntologyClass, OntologyField, OntologyRegistry } from "./types";
import type { OntologyRegistryPayload } from "./load-registry";

function mergeField(
  staticF: OntologyField,
  apiF: OntologyField | undefined
): OntologyField {
  if (!apiF) return staticF;
  return {
    ...staticF,
    ...(apiF.slot_uri ? { slot_uri: apiF.slot_uri } : {}),
  };
}

function mergeClass(
  staticC: OntologyClass,
  apiC: OntologyClass | undefined
): OntologyClass {
  if (!apiC) return staticC;
  const byKey = new Map(apiC.fields.map((f) => [f.key, f] as const));
  const fields = staticC.fields.map((f) => mergeField(f, byKey.get(f.key)));
  return {
    ...staticC,
    classUri: apiC.classUri ?? staticC.classUri,
    description: staticC.description || apiC.description,
    fields,
  };
}

/**
 * Keep hand-tuned UI (static registry) and overlay slot_uri / new classes from the API.
 */
export function mergeOntologyRegistries(
  baseline: OntologyRegistry,
  api: Pick<OntologyRegistryPayload, "classes" | "enums">
): OntologyRegistry {
  const classes: Record<string, OntologyClass> = { ...baseline.classes };
  for (const [key, apiC] of Object.entries(api.classes)) {
    const s = baseline.classes[key];
    classes[key] = s ? mergeClass(s, apiC) : apiC;
  }
  const enums = { ...baseline.enums, ...api.enums };
  return { classes, enums };
}
