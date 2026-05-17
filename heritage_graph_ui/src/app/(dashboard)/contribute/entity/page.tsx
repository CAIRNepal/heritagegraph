"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import OntologyForm from "@/components/ontology-form";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { OntologyUnavailablePanel } from "@/components/ontology/OntologyUnavailablePanel";
import { ProjectContributeBanner } from "@/components/projects/project-contribute-banner";
import { getApiErrorMessage } from "@/lib/api-client";
import { getProject, linkProjectEntity } from "@/lib/projects-api";
import {
  buildPatternCompletionUrl,
  parseSemanticWorkflowParams,
} from "@/lib/semantic-workflow-params";

function ContributeEntityInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const projectSlug = searchParams.get("project")?.trim() || null;
  const [projectTitle, setProjectTitle] = useState<string | null>(null);

  /** `?id=` = CIDOC / cultural-entity record to edit; `?ce=` = cultural entity UUID for OCR uploads */
  const ocrCulturalEntityId = searchParams.get("ce")?.trim() || null;
  const wf = parseSemanticWorkflowParams(searchParams);
  const redirectTo = projectSlug
    ? `/contribute/projects/${projectSlug}`
    : wf
      ? buildPatternCompletionUrl(wf.patternKey, wf.stepOrder)
      : "/knowledge/entity";
  const { getOntologyClass } = useOntology();
  const cls = getOntologyClass("entity");

  useEffect(() => {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!projectSlug || !token) return;
    getProject(projectSlug, token)
      .then((p) => setProjectTitle(p.title))
      .catch(() => setProjectTitle(null));
  }, [projectSlug, session]);

  if (!cls) {
    return <OntologyUnavailablePanel variant="contribute" missingKey="entity" />;
  }

  return (
    <>
      {projectSlug && (
        <ProjectContributeBanner slug={projectSlug} title={projectTitle ?? undefined} />
      )}
      <OntologyForm
        ontologyClass={cls}
        redirectTo={redirectTo}
        ocrCulturalEntityId={ocrCulturalEntityId}
        onContributionCreated={
          projectSlug
            ? async (result) => {
                const token = (session as { accessToken?: string } | null)?.accessToken;
                if (!token) return;
                try {
                  await linkProjectEntity(projectSlug, token, result.id);
                  toast.success("Entity linked to your project.");
                  router.push(`/contribute/projects/${projectSlug}`);
                } catch (e) {
                  toast.error(getApiErrorMessage(e, "Created, but could not link to project."));
                  router.push(redirectTo);
                }
              }
            : undefined
        }
      />
    </>
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
