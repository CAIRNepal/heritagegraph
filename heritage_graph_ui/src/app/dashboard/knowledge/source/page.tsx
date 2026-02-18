"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function SourceKnowledgePage() {
  const cls = getOntologyClass("source")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
