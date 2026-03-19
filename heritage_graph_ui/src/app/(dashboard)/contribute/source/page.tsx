"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeSourcePage() {
  const cls = getOntologyClass("source")!;
  return <OntologyForm ontologyClass={cls} />;
}
