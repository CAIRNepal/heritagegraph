"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributePeriodPage() {
  const cls = getOntologyClass("period")!;
  return <OntologyForm ontologyClass={cls} />;
}
