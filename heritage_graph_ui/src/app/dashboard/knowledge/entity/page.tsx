"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import type { OntologyClass } from "@/lib/ontology/types";

/**
 * CulturalEntity uses the legacy /data/api/cultural-entities/ endpoint,
 * so we define its shape inline.
 */
const culturalEntity: OntologyClass = {
  key: "entity",
  label: "Cultural Entity",
  labelPlural: "Cultural Entities",
  description: "Browse contributed cultural entities — monuments, festivals, rituals, traditions, and artifacts",
  classUri: "heritageGraph:CulturalEntity",
  icon: "landmark",
  apiEndpoint: "/data/api/cultural-entities/",
  category: "tangible",
  navigable: true,
  sections: [{ key: "basic", label: "Basic Information" }],
  fields: [
    { key: "name", label: "Name", type: "text", required: true, section: "basic", order: 1 },
    { key: "category", label: "Category", type: "text", section: "basic", order: 2 },
    { key: "description", label: "Description", type: "textarea", section: "basic", order: 3 },
    { key: "status", label: "Status", type: "text", section: "basic", order: 4 },
  ],
  columns: [
    { key: "name", label: "Name", sortable: true, visible: true },
    { key: "category", label: "Category", sortable: true, visible: true, format: "badge" },
    { key: "status", label: "Status", sortable: true, visible: true, format: "badge" },
    { key: "description", label: "Description", visible: true },
  ],
};

export default function EntityKnowledgePage() {
  return (
    <OntologyDataTable
      ontologyClass={culturalEntity}
      contributePath="/dashboard/contribute/entity"
    />
  );
}
