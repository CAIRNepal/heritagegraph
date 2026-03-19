"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeCalendarPage() {
  const cls = getOntologyClass("calendar")!;
  return <OntologyForm ontologyClass={cls} />;
}
