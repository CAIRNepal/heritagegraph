"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-client";
import { glassCard } from "@/lib/design";
import {
  deleteProjectAsset,
  startProjectAssetOcr,
  type ProjectAssetRow,
} from "@/lib/projects-api";
import { ProjectOcrSuggestionDrawer } from "@/components/projects/project-ocr-suggestion-drawer";

const OCR_LABELS: Record<string, string> = {
  not_started: "Not extracted",
  not_applicable: "No OCR",
  pending: "Queued",
  processing: "Processing",
  completed: "Ready",
  failed: "Failed",
};

export function ProjectAssetCard({
  slug,
  accessToken,
  asset,
  canEdit,
  onChange,
}: {
  slug: string;
  accessToken: string;
  asset: ProjectAssetRow;
  canEdit: boolean;
  onChange: () => void;
}) {
  const [extracting, setExtracting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [docId, setDocId] = useState(asset.uploaded_document_id);

  const ocrEligible =
    asset.ocr_status === "not_started" ||
    asset.ocr_status === "failed" ||
    asset.ocr_status === "completed";

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const updated = await startProjectAssetOcr(slug, asset.id, accessToken);
      const id = updated.uploaded_document_id;
      if (id) {
        setDocId(id);
        setReviewOpen(true);
      }
      onChange();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not start extraction."));
    } finally {
      setExtracting(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("Remove this asset from the project?")) return;
    try {
      await deleteProjectAsset(slug, asset.id, accessToken);
      toast.success("Asset removed.");
      onChange();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const icon = asset.media_type?.startsWith("image")
    ? "🖼"
    : asset.media_type?.startsWith("audio")
      ? "🎵"
      : "📄";

  return (
    <>
      <div className={`${glassCard} p-3 space-y-2`}>
        <div className="flex items-start gap-2">
          <div className="w-10 h-10 rounded bg-primary/10 dark:bg-primary/10 flex items-center justify-center text-lg shrink-0">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{asset.caption || "Untitled asset"}</p>
            <p className="text-xs text-muted-foreground">
              {asset.role} · {asset.media_type}
            </p>
            {asset.version_label ? (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Label: {asset.version_label}
              </p>
            ) : null}
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {OCR_LABELS[asset.ocr_status] ?? asset.ocr_status}
          </Badge>
        </div>
        {asset.media_url && asset.media_type?.startsWith("image") && (
          <a href={asset.media_url} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asset.media_url}
              alt={asset.caption || "Asset"}
              className="rounded-md max-h-32 w-full object-cover"
            />
          </a>
        )}
        {asset.entity_suggestions && asset.entity_suggestions.length > 0 && (
          <details className="text-xs rounded-md border border-primary/30 dark:border-primary/30 bg-primary/10 dark:bg-primary/10 px-2 py-1.5">
            <summary className="cursor-pointer font-medium select-none">
              Suggested entities ({asset.entity_suggestions.length})
            </summary>
            <ul className="mt-2 space-y-1 text-muted-foreground list-disc list-inside max-h-32 overflow-auto">
              {asset.entity_suggestions.map((s, i) => (
                <li key={`${s.label}-${i}`}>
                  <span className="text-foreground">{s.label}</span>
                  {s.ontology_class ? ` (${s.ontology_class})` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            {ocrEligible && asset.ocr_status !== "completed" && (
              <Button size="sm" variant="outline" disabled={extracting} onClick={() => void handleExtract()}>
                {extracting ? "Starting…" : "Extract text"}
              </Button>
            )}
            {(asset.ocr_status === "completed" || docId) && (
              <Button size="sm" variant="secondary" onClick={() => setReviewOpen(true)}>
                Review suggestions
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void handleRemove()}>
              Remove
            </Button>
          </div>
        )}
      </div>
      {reviewOpen && docId && (
        <ProjectOcrSuggestionDrawer
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          projectSlug={slug}
          uploadedDocumentId={docId}
          accessToken={accessToken}
        />
      )}
    </>
  );
}
