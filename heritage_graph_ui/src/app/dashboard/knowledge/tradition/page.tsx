"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function TraditionKnowledgePage() {
  const cls = getOntologyClass("tradition")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
