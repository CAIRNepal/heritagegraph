/**
 * Renderer-agnostic form intermediate representation (MT7).
 * Extend as the registry grows beyond flat OntologyField lists.
 */

export type FormFieldKind =
  | "literal"
  | "enum"
  | "relation"
  | "coordinates"
  | "group";

export interface FormFieldIRBase {
  kind: FormFieldKind;
  key: string;
  label: string;
  required?: boolean;
  description?: string;
  section?: string;
  order?: number;
}

export interface LiteralFieldIR extends FormFieldIRBase {
  kind: "literal";
  valueType: "string" | "number" | "boolean" | "date" | "url";
  multivalued?: boolean;
}

export interface EnumFieldIR extends FormFieldIRBase {
  kind: "enum";
  options: readonly { value: string; label: string }[];
}

export interface RelationFieldIR extends FormFieldIRBase {
  kind: "relation";
  relationTo?: string;
  relationEndpoint?: string;
  multivalued?: boolean;
}

export interface CoordinatesFieldIR extends FormFieldIRBase {
  kind: "coordinates";
}

export interface GroupFieldIR extends FormFieldIRBase {
  kind: "group";
  children: FormFieldIR[];
}

export type FormFieldIR =
  | LiteralFieldIR
  | EnumFieldIR
  | RelationFieldIR
  | CoordinatesFieldIR
  | GroupFieldIR;
