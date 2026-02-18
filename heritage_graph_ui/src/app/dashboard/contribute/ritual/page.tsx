"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeRitualPage() {
  const cls = getOntologyClass("ritual")!;
  return <OntologyForm ontologyClass={cls} />;
}
