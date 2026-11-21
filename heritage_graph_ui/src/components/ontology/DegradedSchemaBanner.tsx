"use client";

import { useState } from "react";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { isPublicApiUrlConfigured } from "@/lib/api-base";

/** Non-blocking banner when schema API or snapshot fallback was used (offline / auth). */
export function DegradedSchemaBanner() {
  const { degraded, degradedReason } = useOntology();
  const [dismissed, setDismissed] = useState(false);

  // If the API base is missing, `ApiBaseWarning` already provides the right guidance.
  if (!isPublicApiUrlConfigured()) return null;

  if (!degraded || dismissed) return null;
  return (
    <div
      role="status"
      className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
    >
      <span>
        {degradedReason === "snapshot"
          ? "Ontology schema served from fallback snapshot — it may be stale until the API loads."
          : "Ontology schema is degraded — some fields may be unavailable until the API loads."}
      </span>
      <button
        type="button"
        className="shrink-0 underline underline-offset-2 hover:text-foreground"
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </div>
  );
}
