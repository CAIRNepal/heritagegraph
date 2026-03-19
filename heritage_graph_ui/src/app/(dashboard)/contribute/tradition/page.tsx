"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeTraditionPage() {
  const cls = getOntologyClass("tradition")!;
  return <OntologyForm ontologyClass={cls} />;
}
