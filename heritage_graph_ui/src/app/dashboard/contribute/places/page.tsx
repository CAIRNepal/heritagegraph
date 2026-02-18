"use client";

import OntologyForm from "@/components/ontology-form";
import { getOntologyClass } from "@/lib/ontology";

export default function ContributePlacesPage() {
  const cls = getOntologyClass("location")!;
  return <OntologyForm ontologyClass={cls} title="Contribute Place" />;
}
