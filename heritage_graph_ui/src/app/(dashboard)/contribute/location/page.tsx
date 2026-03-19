"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeLocationPage() {
  const cls = getOntologyClass("location")!;
  return <OntologyForm ontologyClass={cls} />;
}
