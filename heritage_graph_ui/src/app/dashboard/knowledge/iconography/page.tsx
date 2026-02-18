"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function IconographyKnowledgePage() {
  const cls = getOntologyClass("iconography")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
