"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function PeriodKnowledgePage() {
  const cls = getOntologyClass("period")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
