"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { ontologyClasses } from "./registry";
import { ontologyEnums } from "./enums";
import { generatedOntologyRegistry } from "./registry.generated";
import { loadOntologyRegistry } from "./load-registry";
import { mergeOntologyRegistries } from "./merge-registries";
import type { OntologyClass, OntologyRegistry } from "./types";

type OntologyCtx = {
  /** True after the first local/remote merge pass (usually instant; static baseline is always available). */
  ready: boolean;
  degraded: boolean;
  schemaVersion: string | null;
  registry: OntologyRegistry;
  reload: () => Promise<void>;
  getOntologyClass: (key: string) => OntologyClass | undefined;
  getNavigableClasses: () => OntologyClass[];
};

const OntologyContext = createContext<OntologyCtx | null>(null);

const baseline: OntologyRegistry = {
  classes: ontologyClasses,
  enums: ontologyEnums,
};

export function OntologyProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [registry, setRegistry] = useState<OntologyRegistry>(baseline);
  const [degraded, setDegraded] = useState(false);
  const [schemaVersion, setSchemaVersion] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const runLoad = useCallback(async () => {
    try {
      const token =
        status === "authenticated"
          ? (session as { accessToken?: string | null } | null)?.accessToken
          : undefined;
      const api = await loadOntologyRegistry(token);
      setRegistry(mergeOntologyRegistries(baseline, api));
      setSchemaVersion(api.schema_version);
      setDegraded(Boolean(api.degraded));
    } catch {
      try {
        const snap = generatedOntologyRegistry as unknown as {
          classes: typeof ontologyClasses;
          enums: typeof ontologyEnums;
        };
        setRegistry(
          mergeOntologyRegistries(baseline, {
            classes: snap.classes as Record<string, OntologyClass>,
            enums: snap.enums,
          })
        );
      } catch {
        setRegistry(baseline);
      }
      setDegraded(true);
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
      schemaVersion,
      registry,
      reload: runLoad,
      getOntologyClass,
      getNavigableClasses,
    }),
    [
      ready,
      degraded,
      schemaVersion,
      registry,
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
