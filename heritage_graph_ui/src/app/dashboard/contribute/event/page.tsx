"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeEventPage() {
  const cls = getOntologyClass("event")!;
  return <OntologyForm ontologyClass={cls} />;
}
