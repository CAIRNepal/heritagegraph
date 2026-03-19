"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeDocumentationPage() {
  const cls = getOntologyClass("documentation")!;
  return <OntologyForm ontologyClass={cls} />;
}
