"use client";

import { GenericDataTable, culturalEntityTableConfig } from "@/components/generic-data-table";

export default function IconographyKnowledgePage() {
  return (
    <div className="space-y-0">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-blue-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden">
        <GenericDataTable config={culturalEntityTableConfig} />
      </div>
    </div>
  );
}
