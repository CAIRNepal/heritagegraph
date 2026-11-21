"use client";

import { useParams } from "next/navigation";

import { IngestionWizard } from "@/components/ingestion/ingestion-wizard";

export default function ContributeIngestionDocumentPage() {
  const params = useParams();
  const raw = params.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;

  return <IngestionWizard initialDocumentId={id} />;
}
