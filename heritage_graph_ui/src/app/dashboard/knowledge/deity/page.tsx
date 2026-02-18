"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function DeityKnowledgePage() {
  const cls = getOntologyClass("deity")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
