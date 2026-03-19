"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributePersonPage() {
  const cls = getOntologyClass("person")!;
  return <OntologyForm ontologyClass={cls} />;
}
