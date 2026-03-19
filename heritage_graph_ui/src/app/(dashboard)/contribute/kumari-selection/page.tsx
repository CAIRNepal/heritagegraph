"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeKumariSelectionPage() {
  const cls = getOntologyClass("kumari_selection")!;
  return <OntologyForm ontologyClass={cls} />;
}
