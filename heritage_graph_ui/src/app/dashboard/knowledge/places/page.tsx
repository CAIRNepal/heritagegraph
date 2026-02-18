"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function PlacesKnowledgePage() {
  const cls = getOntologyClass("location")!;
  return <OntologyDataTable ontologyClass={cls} title="Places" />;
}
