"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function EventKnowledgePage() {
  const cls = getOntologyClass("event")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
