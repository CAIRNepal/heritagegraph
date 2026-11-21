"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OntologyForm from "@/components/ontology-form";
import { OntologyUnavailablePanel } from "@/components/ontology/OntologyUnavailablePanel";
import { ProjectContributeBanner } from "@/components/projects/project-contribute-banner";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { useProjectContributeContext } from "@/lib/project-contribute";
import {
  buildPatternCompletionUrl,
  parseSemanticWorkflowParams,
} from "@/lib/semantic-workflow-params";

function ContributeOntologyFormInner({ ontologyKey }: { ontologyKey: string }) {
  const searchParams = useSearchParams();
  const ce = searchParams.get("ce")?.trim() || null;
  const resumeEncoded = searchParams.get("resume")?.trim() || null;
  const rawPickRole = searchParams.get("pickRole")?.trim();
  const resumePickRole =
    rawPickRole === "primary" || rawPickRole === "supporting"
      ? rawPickRole
      : undefined;
  const wf = parseSemanticWorkflowParams(searchParams);
  const projectCtx = useProjectContributeContext();

  const redirectTo =
    projectCtx.redirectTo ??
    (wf ? buildPatternCompletionUrl(wf.patternKey, wf.stepOrder, projectCtx.projectSlug) : undefined);

  const ocrCulturalEntityId = ce;
  const ocrUploadedDocumentId = projectCtx.ocrDocumentId;

  const { getOntologyClass } = useOntology();
  const cls = getOntologyClass(ontologyKey);
  if (!cls) {
    return (
      <OntologyUnavailablePanel variant="contribute" missingKey={ontologyKey} />
    );
  }
  return (
    <>
      {projectCtx.projectSlug && (
        <ProjectContributeBanner
          slug={projectCtx.projectSlug}
          title={projectCtx.projectTitle ?? undefined}
        />
      )}
      <OntologyForm
        ontologyClass={cls}
        ocrCulturalEntityId={ocrCulturalEntityId}
        ocrUploadedDocumentId={ocrUploadedDocumentId}
        resumeEncoded={resumeEncoded}
        resumePickRole={resumePickRole}
        redirectTo={redirectTo}
        onContributionCreated={projectCtx.onContributionCreated}
      />
    </>
  );
}

export function ContributeOntologyForm({ ontologyKey }: { ontologyKey: string }) {
  return (
    <Suspense
      fallback={
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading form…
        </div>
      }
    >
      <ContributeOntologyFormInner ontologyKey={ontologyKey} />
    </Suspense>
  );
}
