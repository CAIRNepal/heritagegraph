// Barrel export for ontology module
export { ontologyEnums, type OntologyEnumOption } from "./enums";
export {
  ontologyClasses,
  getOntologyClass,
  getNavigableClasses,
  getClassesByCategory,
  categoryMeta,
} from "./registry";
export { OntologyProvider, useOntology } from "./OntologyProvider";
export { mergeOntologyRegistries } from "./merge-registries";
export { loadOntologyRegistry, type OntologyRegistryPayload } from "./load-registry";
export { validateRequiredFields } from "./useValidation";
export type {
  OntologyField,
  OntologyColumn,
  OntologySection,
  OntologyClass,
  OntologyRegistry,
} from "./types";
