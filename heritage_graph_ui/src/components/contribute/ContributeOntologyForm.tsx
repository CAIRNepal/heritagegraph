"use client";

import OntologyForm from "@/components/ontology-form";
import { OntologyUnavailablePanel } from "@/components/ontology/OntologyUnavailablePanel";
import { useOntology } from "@/lib/ontology/OntologyProvider";

export function ContributeOntologyForm({ ontologyKey }: { ontologyKey: string }) {
  const { getOntologyClass } = useOntology();
  const cls = getOntologyClass(ontologyKey);
  if (!cls) {
    return (
      <OntologyUnavailablePanel variant="contribute" missingKey={ontologyKey} />
    );
  }
  return <OntologyForm ontologyClass={cls} />;
}
