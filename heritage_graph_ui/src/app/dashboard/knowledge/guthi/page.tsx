"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function GuthiKnowledgePage() {
  const cls = getOntologyClass("guthi")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
