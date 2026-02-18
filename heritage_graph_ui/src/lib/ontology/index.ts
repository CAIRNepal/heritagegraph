// Barrel export for ontology module
export { ontologyEnums, type OntologyEnumOption } from "./enums";
export {
  ontologyClasses,
  getOntologyClass,
  getNavigableClasses,
  getClassesByCategory,
  categoryMeta,
} from "./registry";
export type {
  OntologyField,
  OntologyColumn,
  OntologySection,
  OntologyClass,
  OntologyRegistry,
} from "./types";
