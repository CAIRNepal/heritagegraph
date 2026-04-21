"use client";

import { useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import OntologyForm, { type OntologyFormControlApi } from "@/components/ontology-form";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { OntologyUnavailablePanel } from "@/components/ontology/OntologyUnavailablePanel";
import { HeritageDocumentUpload } from "@/components/ocr/heritage-document-upload";
import type { OcrFieldSuggestion } from "@/hooks/use-heritage-ocr-suggestions";

export default function ContributeEntityPage() {
  const searchParams = useSearchParams();
  const entityId = searchParams.get("id")?.trim() || "";
  const formApiRef = useRef<OntologyFormControlApi | null>(null);
  const { getOntologyClass } = useOntology();
  const cls = getOntologyClass("entity");

  const onFormControl = useCallback((api: OntologyFormControlApi) => {
    formApiRef.current = api;
  }, []);

  const onApplyOcr = useCallback((suggestions: Record<string, OcrFieldSuggestion>) => {
    const api = formApiRef.current;
    if (!api) {
      toast.error("Form is not ready yet — try again in a moment.");
      return;
    }
    const patch: Record<string, unknown> = {};
    for (const [k, s] of Object.entries(suggestions)) {
      if (!k) continue;
      patch[k] = s.value;
    }
    const before = api.getValues();
    api.mergeValues(patch, { onlyIfEmpty: true });
    const after = api.getValues();
    const applied = Object.keys(patch).filter(
      (k) => (before as Record<string, unknown>)[k] !== (after as Record<string, unknown>)[k]
    );
    if (applied.length === 0) {
      toast.message("No suggestions applied (fields already had values).");
    } else {
      toast.success(`Applied ${applied.length} suggestion(s) to empty fields.`);
    }
  }, []);

  if (!cls) {
    return <OntologyUnavailablePanel variant="contribute" missingKey="entity" />;
  }

  return (
    <div className="space-y-6">
      {entityId ? (
        <HeritageDocumentUpload culturalEntityId={entityId} onApply={onApplyOcr} />
      ) : null}
      <OntologyForm
        ontologyClass={cls}
        redirectTo="/knowledge/entity"
        onFormControl={onFormControl}
      />
    </div>
  );
}
