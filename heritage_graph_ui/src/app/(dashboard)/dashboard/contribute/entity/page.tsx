"use client";

import OntologyForm from "@/components/ontology-form";
import type { OntologyClass } from "@/lib/ontology/types";
import { ontologyEnums } from "@/lib/ontology/enums";

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
  return (
    <OntologyForm
      ontologyClass={culturalEntity}
      redirectTo="/dashboard/knowledge/entity"
    />
  );
}
