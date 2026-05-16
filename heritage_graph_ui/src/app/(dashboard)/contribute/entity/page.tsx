"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OntologyForm from "@/components/ontology-form";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { OntologyUnavailablePanel } from "@/components/ontology/OntologyUnavailablePanel";
import {
  buildPatternCompletionUrl,
  parseSemanticWorkflowParams,
} from "@/lib/semantic-workflow-params";

function ContributeEntityInner() {
  const searchParams = useSearchParams();
  /** `?id=` = CIDOC / cultural-entity record to edit; `?ce=` = cultural entity UUID for OCR uploads */
  const ocrCulturalEntityId = searchParams.get("ce")?.trim() || null;
  const wf = parseSemanticWorkflowParams(searchParams);
  const redirectTo = wf
    ? buildPatternCompletionUrl(wf.patternKey, wf.stepOrder)
    : "/knowledge/entity";
  const { getOntologyClass } = useOntology();
  const cls = getOntologyClass("entity");

  if (!cls) {
    return <OntologyUnavailablePanel variant="contribute" missingKey="entity" />;
  }

  return (
    <OntologyForm
      ontologyClass={cls}
      redirectTo={redirectTo}
      ocrCulturalEntityId={ocrCulturalEntityId}
    />
  );
}

export default function ContributeEntityPage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ContributeEntityInner />
    </Suspense>
  );
}
