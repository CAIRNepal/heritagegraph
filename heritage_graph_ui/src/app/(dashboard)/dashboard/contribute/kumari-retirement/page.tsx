"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeKumariRetirementPage() {
  const cls = getOntologyClass("kumari_retirement")!;
  return <OntologyForm ontologyClass={cls} />;
}
