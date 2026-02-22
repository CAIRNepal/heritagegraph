"use client";

import OntologyDataTable from "@/components/ontology-data-table";
import { getOntologyClass } from "@/lib/ontology";

export default function EventKnowledgePage() {
  const cls = getOntologyClass("event")!;
  return (
    <div className="space-y-0">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden">
        <OntologyDataTable ontologyClass={cls} />
      </div>
    </div>
  );
}
