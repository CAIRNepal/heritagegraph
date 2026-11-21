// Barrel export for ontology module
export { ontologyEnums, type EnumKey } from "./enums";
export {
  OntologyProvider,
  useOntology,
  type CurationFormRole,
} from "./OntologyProvider";
export { loadOntologyRegistry, type OntologyRegistryPayload } from "./load-registry";
export {
  validateRequiredFields,
  validateRequiredFieldsForFieldKeys,
} from "./useValidation";
export {
  buildOntologyFormDraftStorageKey,
  clearOntologyFormDraft,
  loadOntologyFormDraft,
  saveOntologyFormDraft,
  type OntologyFormDraftPayload,
} from "./form-drafts";
export type {
  ContributeHubCategoryRow,
  ContributeHubIntentRow,
  ContributeHubPayload,
  OntologyField,
  OntologyColumn,
  OntologyClass,
  OntologyRegistry,
  RegistryJsonSchemaBlob,
} from "./types";
export type { FormFieldIR } from "./form-ir";
export { validatePayloadAgainstRegistrySchema } from "./validate-registry-payload";
