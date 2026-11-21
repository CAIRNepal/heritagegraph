"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { getPublicApiUrl } from "@/lib/api-base";
import { generatedOntologyRegistry } from "./registry.generated";
import { loadOntologyRegistry } from "./load-registry";
import type {
  ContributeHubPayload,
  OntologyClass,
  OntologyRegistry,
} from "./types";

const emptyContributeHub: ContributeHubPayload = {
  hubCategories: [],
  intents: [],
  quickStart: [],
};

function normalizeRegistry(
  payload: Pick<OntologyRegistry, "classes" | "enums"> & {
    contribute_hub?: ContributeHubPayload;
    semantic_patterns?: OntologyRegistry["semantic_patterns"];
    registry_jsonschema?: OntologyRegistry["registry_jsonschema"];
    schema_version?: string;
  },
  fallbackHub?: ContributeHubPayload | null,
  fallbackPatterns?: OntologyRegistry["semantic_patterns"]
): OntologyRegistry {
  const apiHub = payload.contribute_hub;
  const hubHasIntents = Boolean(apiHub?.intents?.length);
  const contribute_hub = hubHasIntents
    ? apiHub!
    : (fallbackHub ?? apiHub ?? emptyContributeHub);

  const apiPatterns = payload.semantic_patterns;
  const semantic_patterns =
    apiPatterns && apiPatterns.length > 0
      ? apiPatterns
      : (fallbackPatterns ?? apiPatterns ?? []);

  return {
    schema_version: payload.schema_version,
    classes: payload.classes,
    enums: payload.enums,
    contribute_hub,
    semantic_patterns,
    registry_jsonschema: payload.registry_jsonschema,
  };
}

export type CurationFormRole =
  | "curator"
  | "reviewer"
  | "ontology_engineer";

type OntologyCtx = {
  /** True after the first local/remote merge pass (usually instant; static baseline is always available). */
  ready: boolean;
  degraded: boolean;
  /** Why the registry is degraded (used for user-facing copy). */
  degradedReason: "snapshot" | "unconfigured_api" | "unauthenticated" | "unknown" | null;
  schemaVersion: string | null;
  registry: OntologyRegistry;
  /** UI affordances for multi-role curation (MR4). */
  formRole: CurationFormRole;
  reload: () => Promise<void>;
  getOntologyClass: (key: string) => OntologyClass | undefined;
  getNavigableClasses: () => OntologyClass[];
};

const OntologyContext = createContext<OntologyCtx | null>(null);

const gen = generatedOntologyRegistry as unknown as {
  classes: OntologyRegistry["classes"];
  enums: OntologyRegistry["enums"];
  contribute_hub?: ContributeHubPayload;
  semantic_patterns?: OntologyRegistry["semantic_patterns"];
};

const baseline: OntologyRegistry = normalizeRegistry({
  classes: gen.classes,
  enums: gen.enums,
  contribute_hub: gen.contribute_hub,
  semantic_patterns: gen.semantic_patterns,
  registry_jsonschema: (gen as { registry_jsonschema?: OntologyRegistry["registry_jsonschema"] })
    .registry_jsonschema,
  schema_version: (gen as { schema_version?: string }).schema_version,
});

const bundledHubFallback: ContributeHubPayload =
  gen.contribute_hub && gen.contribute_hub.intents?.length
    ? gen.contribute_hub
    : emptyContributeHub;
const bundledPatternsFallback = gen.semantic_patterns ?? [];

export function OntologyProvider({
  children,
  formRole = "curator",
}: {
  children: ReactNode;
  formRole?: CurationFormRole;
}) {
  const { data: session, status } = useSession();
  const [registry, setRegistry] = useState<OntologyRegistry>(baseline);
  const [degraded, setDegraded] = useState(false);
  const [degradedReason, setDegradedReason] =
    useState<OntologyCtx["degradedReason"]>(null);
  const [schemaVersion, setSchemaVersion] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const runLoad = useCallback(async () => {
    // If NEXT_PUBLIC_API_URL is missing in a production build, do not attempt to fetch.
    // A dedicated banner (`ApiBaseWarning`) already guides the user to set it.
    if (!getPublicApiUrl()) {
      setRegistry(baseline);
      setSchemaVersion(null);
      setDegraded(false);
      setDegradedReason("unconfigured_api");
      setReady(true);
      return;
    }

    // Avoid treating an unauthenticated 401 as "schema API is down".
    if (status !== "authenticated") {
      setRegistry(baseline);
      setSchemaVersion(null);
      setDegraded(false);
      setDegradedReason("unauthenticated");
      setReady(true);
      return;
    }

    try {
      const token =
        (session as { accessToken?: string | null } | null)?.accessToken;
      const api = await loadOntologyRegistry(token);
      setRegistry(
        normalizeRegistry(
          {
            ...api,
            registry_jsonschema: api.registry_jsonschema,
          },
          bundledHubFallback,
          bundledPatternsFallback
        )
      );
      setSchemaVersion(api.schema_version);
      setDegraded(Boolean(api.degraded));
      setDegradedReason(api.degraded ? "snapshot" : null);
    } catch {
      try {
        setRegistry(
          normalizeRegistry({
            classes: gen.classes,
            enums: gen.enums,
            contribute_hub: gen.contribute_hub,
            semantic_patterns: gen.semantic_patterns,
            registry_jsonschema: (gen as { registry_jsonschema?: OntologyRegistry["registry_jsonschema"] })
              .registry_jsonschema,
            schema_version: (gen as { schema_version?: string }).schema_version,
          })
        );
      } catch {
        setRegistry(baseline);
      }
      setDegraded(true);
      setDegradedReason("snapshot");
    } finally {
      setReady(true);
    }
  }, [session, status]);

  useEffect(() => {
    void runLoad();
  }, [runLoad]);

  const getOntologyClass = useCallback(
    (key: string) => registry.classes[key],
    [registry.classes]
  );

  const getNavigableClasses = useCallback(
    () => Object.values(registry.classes).filter((c) => c.navigable),
    [registry.classes]
  );

  const value = useMemo<OntologyCtx>(
    () => ({
      ready,
      degraded,
      degradedReason,
      schemaVersion,
      registry,
      formRole,
      reload: runLoad,
      getOntologyClass,
      getNavigableClasses,
    }),
    [
      ready,
      degraded,
      degradedReason,
      schemaVersion,
      registry,
      formRole,
      runLoad,
      getOntologyClass,
      getNavigableClasses,
    ]
  );

  return (
    <OntologyContext.Provider value={value}>{children}</OntologyContext.Provider>
  );
}

export function useOntology(): OntologyCtx {
  const ctx = useContext(OntologyContext);
  if (!ctx) {
    throw new Error("useOntology must be used within OntologyProvider");
  }
  return ctx;
}
