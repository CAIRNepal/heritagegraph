"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function StructureKnowledgePage() {
  const cls = getOntologyClass("structure")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
