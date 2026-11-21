import type { OntologyRegistry } from "./types";

/** Contribute app path for a registry class key, from embedded `contribute_hub` intents. */
export function getContributePathForRegistryKey(
  registry: OntologyRegistry,
  registryKey: string
): string | null {
  const intents = registry.contribute_hub?.intents ?? [];
  for (const row of intents) {
    if (row.registryKey === registryKey) return row.route;
  }
  return null;
}
