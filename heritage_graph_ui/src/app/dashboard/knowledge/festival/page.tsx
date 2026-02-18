"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function FestivalKnowledgePage() {
  const cls = getOntologyClass("festival")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
