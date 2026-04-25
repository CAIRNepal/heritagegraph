"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OntologyForm from "@/components/ontology-form";
import { OntologyUnavailablePanel } from "@/components/ontology/OntologyUnavailablePanel";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { useContributorMode } from "@/hooks/use-contributor-mode";

function ContributeOntologyFormInner({ ontologyKey }: { ontologyKey: string }) {
  const searchParams = useSearchParams();
  const ce = searchParams.get("ce")?.trim() || null;
  const { getOntologyClass } = useOntology();
  const contributorMode = useContributorMode();
  const cls = getOntologyClass(ontologyKey);
  if (!cls) {
    return (
      <OntologyUnavailablePanel variant="contribute" missingKey={ontologyKey} />
    );
  }
  return (
    <OntologyForm
      ontologyClass={cls}
      ocrCulturalEntityId={ce}
      contributorMode={contributorMode.mode}
      onContributorModeChange={contributorMode.setMode}
      contributorModeLoading={contributorMode.isLoading}
      contributorModeSaving={contributorMode.isSaving}
    />
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
