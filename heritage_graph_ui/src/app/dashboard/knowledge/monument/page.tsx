"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function MonumentKnowledgePage() {
  const cls = getOntologyClass("monument")!;
  return <OntologyDataTable ontologyClass={cls} />;
}
