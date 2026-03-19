"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeDeityPage() {
  const cls = getOntologyClass("deity")!;
  return <OntologyForm ontologyClass={cls} />;
}
