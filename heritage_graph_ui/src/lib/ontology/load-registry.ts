import { apiFetchJson, apiUrl } from "@/lib/api-client";
import type {
  ContributeHubPayload,
  OntologyClass,
  RegistryJsonSchemaBlob,
  SemanticPattern,
} from "./types";

/** Payload matches specs/004-yaml-driven-schema/contracts/openapi-schema-registry.v1.yaml */
export type OntologyRegistryPayload = {
  schema_version: string;
  generated_at?: string | null;
  tenant_id?: string | null;
  degraded?: boolean;
  classes: Record<string, OntologyClass>;
  enums: Record<
    string,
    readonly { readonly value: string; readonly label: string; readonly description?: string }[]
  >;
  contribute_hub?: ContributeHubPayload;
  semantic_patterns?: readonly SemanticPattern[];
  registry_jsonschema?: RegistryJsonSchemaBlob;
};

const _mem: { version: string | null; data: OntologyRegistryPayload | null } = {
  version: null,
  data: null,
};

/**
 * Fetch the live schema registry (Bearer when accessToken is set).
 * Caches in memory for the current tab by schema_version.
 */
export async function loadOntologyRegistry(
  accessToken?: string | null
): Promise<OntologyRegistryPayload> {
  const path = "/api/v1/cidoc/schema/registry/";
  const init: RequestInit = { credentials: "include" };
  if (accessToken) {
    init.headers = { Authorization: `Bearer ${accessToken}` };
  }
  const res = await apiFetchJson<OntologyRegistryPayload>(apiUrl(path), init);
  if (_mem.version === res.schema_version && _mem.data) {
    return _mem.data;
  }
  _mem.version = res.schema_version;
  _mem.data = res;
  return res;
}

export function clearRegistryCache() {
  _mem.version = null;
  _mem.data = null;
}
