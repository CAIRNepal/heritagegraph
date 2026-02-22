"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeAssertionPage() {
  const cls = getOntologyClass("assertion")!;
  return <OntologyForm ontologyClass={cls} />;
}
