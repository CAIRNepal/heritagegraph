"use client";

import { useState } from "react";
import { useOntology } from "@/lib/ontology/OntologyProvider";

/** Non-blocking banner when schema API or snapshot fallback was used (offline / auth). */
export function DegradedSchemaBanner() {
  const { degraded } = useOntology();
  const [dismissed, setDismissed] = useState(false);
  if (!degraded || dismissed) return null;
  return (
    <div
      role="status"
      className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
    >
      <span>
        Ontology schema served from fallback snapshot — RDF URIs may be stale until the API loads.
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
