"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeIconographyPage() {
  const cls = getOntologyClass("iconography")!;
  return <OntologyForm ontologyClass={cls} />;
}
