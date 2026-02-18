"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeStructurePage() {
  const cls = getOntologyClass("structure")!;
  return <OntologyForm ontologyClass={cls} />;
}
