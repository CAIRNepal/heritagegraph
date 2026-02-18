"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function RitualKnowledgePage() {
  const cls = getOntologyClass("ritual")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
