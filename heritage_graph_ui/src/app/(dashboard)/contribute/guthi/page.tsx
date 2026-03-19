"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeGuthiPage() {
  const cls = getOntologyClass("guthi")!;
  return <OntologyForm ontologyClass={cls} />;
}
