"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeMonumentPage() {
  const cls = getOntologyClass("monument")!;
  return <OntologyForm ontologyClass={cls} />;
}
