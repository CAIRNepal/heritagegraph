"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeKumariTenurePage() {
  const cls = getOntologyClass("kumari_tenure")!;
  return <OntologyForm ontologyClass={cls} />;
}
