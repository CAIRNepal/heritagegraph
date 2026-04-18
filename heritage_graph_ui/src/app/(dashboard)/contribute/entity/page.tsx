"use client";

import { useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import OntologyForm, { type OntologyFormControlApi } from "@/components/ontology-form";
import type { OntologyClass } from "@/lib/ontology/types";
import { HeritageDocumentUpload } from "@/components/ocr/heritage-document-upload";
import type { OcrFieldSuggestion } from "@/hooks/use-heritage-ocr-suggestions";

/**
 * CulturalEntity uses the legacy /data/api/cultural-entities/ endpoint
 * with a different payload shape, so we define it inline rather than
 * pulling from the CIDOC registry.
 */
const culturalEntity: OntologyClass = {
  key: "entity",
  label: "Cultural Entity",
  labelPlural: "Cultural Entities",
  description: "Contribute monuments, festivals, rituals, traditions, and artifacts",
  classUri: "heritageGraph:CulturalEntity",
  icon: "landmark",
  apiEndpoint: "/data/api/cultural-entities/",
  category: "tangible",
  navigable: true,
  sections: [{ key: "basic", label: "Basic Information" }],
  fields: [
    { key: "name", label: "Name", type: "text", required: true, section: "basic", order: 1, placeholder: "E.g., Pashupatinath Temple, Dashain Festival", description: "Primary name or label" },
    { key: "category", label: "Category", type: "select", required: true, section: "basic", order: 2, options: [
      { value: "monument", label: "Monument" },
      { value: "festival", label: "Festival" },
      { value: "ritual", label: "Ritual" },
      { value: "tradition", label: "Tradition" },
      { value: "artifact", label: "Artifact" },
      { value: "other", label: "Other" },
    ]},
    { key: "description", label: "Description", type: "textarea", required: true, section: "basic", order: 3, placeholder: "Provide a comprehensive description...", description: "Detailed description of the cultural entity" },
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "category", label: "Category", sortable: true, visible: true, format: "badge" },
    { key: "description", label: "Description", visible: true },
  ],
};

export default function ContributeEntityPage() {
  const searchParams = useSearchParams();
  const entityId = searchParams.get("id")?.trim() || "";
  const formApiRef = useRef<OntologyFormControlApi | null>(null);

  const onFormControl = useCallback((api: OntologyFormControlApi) => {
    formApiRef.current = api;
  }, []);

  const onApplyOcr = useCallback((suggestions: Record<string, OcrFieldSuggestion>) => {
    const api = formApiRef.current;
    if (!api) {
      toast.error("Form is not ready yet — try again in a moment.");
      return;
    }
    const patch: Record<string, any> = {};
    for (const [k, s] of Object.entries(suggestions)) {
      if (!k) continue;
      patch[k] = s.value;
    }
    const before = api.getValues();
    api.mergeValues(patch, { onlyIfEmpty: true });
    const after = api.getValues();
    const applied = Object.keys(patch).filter(
      (k) => (before as any)[k] !== (after as any)[k]
    );
    if (applied.length === 0) {
      toast.message("No suggestions applied (fields already had values).");
    } else {
      toast.success(`Applied ${applied.length} suggestion(s) to empty fields.`);
    }
  }, []);

  return (
    <div className="space-y-6">
      {entityId ? (
        <HeritageDocumentUpload culturalEntityId={entityId} onApply={onApplyOcr} />
      ) : null}
      <OntologyForm
        ontologyClass={culturalEntity}
        redirectTo="/knowledge/entity"
        onFormControl={onFormControl}
      />
    </div>
  );
}
