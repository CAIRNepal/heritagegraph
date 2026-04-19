"use client";

import OntologyForm from "@/components/ontology-form";
import { useOntology } from "@/lib/ontology/OntologyProvider";

export function ContributeOntologyForm({ ontologyKey }: { ontologyKey: string }) {
  const { getOntologyClass } = useOntology();
  const cls = getOntologyClass(ontologyKey);
  if (!cls) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Unknown ontology class: <code className="font-mono">{ontologyKey}</code>
      </div>
    );
  }
  return <OntologyForm ontologyClass={cls} />;
}
