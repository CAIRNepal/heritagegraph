"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeSyncretismPage() {
  const cls = getOntologyClass("syncretism")!;
  return <OntologyForm ontologyClass={cls} />;
}
