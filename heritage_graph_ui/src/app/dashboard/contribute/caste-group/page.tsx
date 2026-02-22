"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeCasteGroupPage() {
  const cls = getOntologyClass("caste_group")!;
  return <OntologyForm ontologyClass={cls} />;
}
