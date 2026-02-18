"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function PersonKnowledgePage() {
  const cls = getOntologyClass("person")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
