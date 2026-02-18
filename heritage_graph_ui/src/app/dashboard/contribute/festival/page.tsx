"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributeFestivalPage() {
  const cls = getOntologyClass("festival")!;
  return <OntologyForm ontologyClass={cls} />;
}
