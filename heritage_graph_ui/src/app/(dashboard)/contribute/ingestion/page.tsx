"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { IngestionWizard } from "@/components/ingestion/ingestion-wizard";

function IngestionPageInner() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  return <IngestionWizard initialDocumentId={id} />;
}

export default function ContributeIngestionPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">Loading ingestion…</div>
      }
    >
      <IngestionPageInner />
    </Suspense>
  );
}
