"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  OcrFieldSuggestion,
  uploadHeritageOcrDocument,
  useHeritageOcrRun,
} from "@/hooks/use-heritage-ocr-suggestions";
import { OcrSuggestionBadge } from "@/components/ocr/ocr-suggestion-badge";

export function HeritageDocumentUpload({
  culturalEntityId,
  className,
  onApply,
}: {
  culturalEntityId: string;
  className?: string;
  onApply: (suggestions: Record<string, OcrFieldSuggestion>) => void;
}) {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const { run: runOcr } = useHeritageOcrRun();

  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "ready" | "error">(
    "idle"
  );
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, OcrFieldSuggestion> | null>(null);

  const canRun = useMemo(
    () => status === "authenticated" && Boolean(token) && Boolean(culturalEntityId),
    [status, token, culturalEntityId]
  );

  const onPick = (f: File | null) => {
    setFile(f);
    setJob(null);
    setSuggestions(null);
    setPhase("idle");
    setStatusLabel(null);
  };

  const onUpload = async () => {
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    if (!token) {
      toast.error("You must be signed in to upload a document.");
      return;
    }
    setPhase("uploading");
    setStatusLabel("Uploading…");
    try {
      const created = await uploadHeritageOcrDocument({
        file,
        culturalEntityId,
        accessToken: token,
        mediaType: "image",
      });
      setJob(created.uploaded_document_id);
      setPhase("processing");
      setStatusLabel(`Processing… (initial status: ${created.status})`);
      const result = await runOcr({
        uploadedDocumentId: created.uploaded_document_id,
        accessToken: token,
        onStatus: (s) => setStatusLabel(`Status: ${s.status}`),
      });
      if (result.status.status === "failed") {
        toast.error("Document processing did not complete successfully.");
        setPhase("error");
      } else {
        setPhase("ready");
        toast.success("Suggestions are ready. Review and apply the ones you want.");
      }
      setSuggestions(result.suggestions);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
      setPhase("error");
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Scan a source document (optional)</CardTitle>
        <CardDescription>
          Upload a PDF or image to extract text and suggested field values. Suggestions are
          non-authoritative: they only fill empty fields when you choose Apply.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ocr-file">File</Label>
          <Input
            id="ocr-file"
            type="file"
            accept="application/pdf,image/*"
            disabled={!canRun || phase === "uploading" || phase === "processing"}
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
        </div>

        {statusLabel ? (
          <p className="text-sm text-muted-foreground">{statusLabel}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            onClick={onUpload}
            disabled={!canRun || !file || phase === "uploading" || phase === "processing"}
          >
            {phase === "uploading"
              ? "Uploading…"
              : phase === "processing"
                ? "Processing…"
                : "Upload & run OCR"}
          </Button>

          {suggestions && Object.keys(suggestions).length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onApply(suggestions)}
              disabled={phase !== "ready" && phase !== "error"}
            >
              Apply suggestions to empty fields
            </Button>
          ) : null}
        </div>

        {job ? (
          <p className="text-xs text-muted-foreground">
            OCR job: <span className="font-mono">{job}</span>
          </p>
        ) : null}

        {suggestions && Object.keys(suggestions).length > 0 ? (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm font-medium">Detected suggestions</p>
            <ul className="space-y-2">
              {Object.entries(suggestions).map(([k, v]) => (
                <li key={k} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground break-all">{k}</div>
                    <div className="text-sm break-words">{v.value}</div>
                  </div>
                  <OcrSuggestionBadge confidence={v.confidence} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
