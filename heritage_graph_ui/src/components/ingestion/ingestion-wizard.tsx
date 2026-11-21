"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  ReactFlowProvider,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "sonner";

import { OcrDocumentViewer } from "@/components/ingestion/ocr-document-viewer";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { fetchOcrStatus, type OcrDocumentStatus } from "@/hooks/use-heritage-ocr-suggestions";
import {
  fetchCidocUniversalSearch,
  fetchDocumentCompilePreview,
  fetchEntityClusterDuplicates,
  fetchOcrAssetBlob,
  fetchOcrReviewPayload,
  finalizeIngestionReview,
  INGESTION_HANDOFF_STORAGE_KEY,
  type DocumentCompilePreviewPayload,
  type IngestionProvenance,
  patchIngestionReviewState,
  type ReviewExtractedFieldPayload,
  type ReviewPayload,
  type SavedFieldDecisionPayload,
  type SavedReviewStatePayload,
  reviewExtractedToSuggestions,
  uploadStandaloneOrChunked,
} from "@/lib/ingestion-api";
import { getContributePathForRegistryKey } from "@/lib/ontology/contribute-intent-routes";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { cn } from "@/lib/utils";

const STEPS = [
  "Upload",
  "Extract",
  "OCR preview",
  "Semantic review",
  "Preview & handoff",
] as const;

type StepIndex = 0 | 1 | 2 | 3 | 4;

const ENTITY_SEARCH_PRIORITY: Record<string, string[]> = {
  PERSON: ["persons", "deities"],
  LOCATION: ["locations", "structures", "monuments"],
  DATE: ["events", "festivals"],
  EVENT: ["events", "festivals", "rituals"],
  ARTIFACT: ["monuments", "structures"],
  TRADITION: ["traditions", "rituals"],
  ORGANIZATION: ["guthis"],
  OTHER: [],
};

const ENTITY_TYPE_SCOPE: Record<string, string> = {
  PERSON: "person",
  LOCATION: "location",
  ARTIFACT: "structure",
  EVENT: "event",
  TRADITION: "tradition",
  ORGANIZATION: "organization",
};

function labelForResourceKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface FieldDecision {
  editedValue: string;
  linked?: { resourceKey: string; id: number; label: string };
  uncertain?: boolean;
}

function hydrateDecisions(
  fields: ReviewExtractedFieldPayload[],
  saved?: SavedReviewStatePayload
): Record<string, FieldDecision> {
  const fd = saved?.field_decisions ?? {};
  const out: Record<string, FieldDecision> = {};
  for (const row of fields) {
    const s = fd[row.id];
    out[row.id] = {
      editedValue: (s?.edited_value ?? row.field_value) || "",
      uncertain: s?.uncertain,
      linked: s?.linked
        ? {
            resourceKey: String(s.linked.resource_key),
            id: Number(s.linked.id),
            label: String(s.linked.label ?? ""),
          }
        : undefined,
    };
  }
  return out;
}

function hydrateBlockCorrectionTexts(saved?: SavedReviewStatePayload): Record<string, string> {
  const bc = saved?.block_corrections ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(bc)) {
    if (v && typeof v === "object" && "corrected_text" in v) {
      out[k] = String((v as { corrected_text?: string }).corrected_text ?? "");
    }
  }
  return out;
}

function buildReviewStatePayload(
  decisions: Record<string, FieldDecision>,
  blockCorrectionTexts: Record<string, string>,
  ontologyHandoffKey: string
): SavedReviewStatePayload {
  const field_decisions: Record<string, SavedFieldDecisionPayload> = {};
  for (const [id, d] of Object.entries(decisions)) {
    field_decisions[id] = {
      edited_value: d.editedValue,
      uncertain: Boolean(d.uncertain),
      linked: d.linked
        ? {
            resource_key: d.linked.resourceKey,
            id: d.linked.id,
            label: d.linked.label,
          }
        : undefined,
    };
  }
  const block_corrections: Record<string, { corrected_text: string }> = {};
  for (const [k, t] of Object.entries(blockCorrectionTexts)) {
    if (t.trim()) block_corrections[k] = { corrected_text: t };
  }
  return {
    field_decisions,
    block_corrections,
    ontology_handoff_key: ontologyHandoffKey,
  };
}

export function IngestionWizard({ initialDocumentId }: { initialDocumentId?: string | null }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken ?? null;
  const { registry } = useOntology();

  const [step, setStep] = useState<StepIndex>(initialDocumentId ? 1 : 0);
  const [files, setFiles] = useState<File[]>([]);
  const [provenance, setProvenance] = useState<IngestionProvenance>({});
  const [jobId, setJobId] = useState<string | null>(initialDocumentId ?? null);
  const [pollStatus, setPollStatus] = useState<OcrDocumentStatus | null>(null);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<Record<string, FieldDecision>>({});
  const [blockCorrectionTexts, setBlockCorrectionTexts] = useState<Record<string, string>>({});
  const [searchBusy, setSearchBusy] = useState<string | null>(null);
  const [searchHits, setSearchHits] = useState<Record<string, unknown[]> | null>(null);
  const [dupBusy, setDupBusy] = useState<string | null>(null);
  const [dupHints, setDupHints] = useState<Record<string, { id: string; canonical_label: string }[]>>(
    {}
  );
  const [ontologyHandoffKey, setOntologyHandoffKey] = useState<string>("person");
  const [compilePreview, setCompilePreview] = useState<DocumentCompilePreviewPayload | null>(null);
  const [mimeHint, setMimeHint] = useState<string>("");

  const canRun = status === "authenticated" && Boolean(token);

  const resumeStartedRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length) setFiles(accepted);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: !canRun || step !== 0,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"],
    },
  });

  const pollUntilDone = useCallback(
    async (uploadedDocumentId: string, accessToken: string) => {
      const maxAttempts = 120;
      for (let i = 0; i < maxAttempts; i++) {
        const st = await fetchOcrStatus({
          uploadedDocumentId,
          accessToken,
        });
        setPollStatus(st);
        if (st.status === "failed" || st.status === "completed") {
          return st;
        }
        await new Promise((r) => window.setTimeout(r, 1500));
      }
      throw new Error("Timed out waiting for OCR to finish.");
    },
    []
  );

  const loadReviewBundle = useCallback(
    async (uploadedDocumentId: string, accessToken: string) => {
      const [payload, blob] = await Promise.all([
        fetchOcrReviewPayload({ uploadedDocumentId, accessToken }),
        fetchOcrAssetBlob({ uploadedDocumentId, accessToken }).catch(() => null),
      ]);
      setReview(payload);
      setDecisions(hydrateDecisions(payload.extracted_fields, payload.saved_review_state));
      setBlockCorrectionTexts(hydrateBlockCorrectionTexts(payload.saved_review_state));
      const hk = payload.saved_review_state?.ontology_handoff_key;
      if (hk && typeof hk === "string") setOntologyHandoffKey(hk);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      }
    },
    []
  );

  useEffect(() => {
    if (!jobId || !token || step < 2) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void patchIngestionReviewState({
        uploadedDocumentId: jobId,
        accessToken: token,
        patch: buildReviewStatePayload(decisions, blockCorrectionTexts, ontologyHandoffKey),
      }).catch(() => {});
    }, 900);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [jobId, token, decisions, blockCorrectionTexts, ontologyHandoffKey, step]);

  useEffect(() => {
    if (!initialDocumentId || !token) return;
    if (resumeStartedRef.current === initialDocumentId) return;
    resumeStartedRef.current = initialDocumentId;
    let cancelled = false;
    (async () => {
      try {
        setJobId(initialDocumentId);
        const st = await fetchOcrStatus({
          uploadedDocumentId: initialDocumentId,
          accessToken: token,
        });
        if (cancelled) return;
        setPollStatus(st);
        if (st.status === "completed" || st.status === "failed") {
          await loadReviewBundle(initialDocumentId, token);
          if (!cancelled) setStep(2);
          return;
        }
        setStep(1);
        await pollUntilDone(initialDocumentId, token);
        if (cancelled) return;
        await loadReviewBundle(initialDocumentId, token);
        if (!cancelled) setStep(2);
      } catch (e: unknown) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not resume document.");
          setStep(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDocumentId, token, loadReviewBundle, pollUntilDone]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    if (step !== 4 || !jobId || !token) return;
    let cancelled = false;
    setCompilePreview(null);
    void (async () => {
      try {
        const data = await fetchDocumentCompilePreview({
          uploadedDocumentId: jobId,
          accessToken: token,
        });
        if (!cancelled) setCompilePreview(data);
      } catch {
        if (!cancelled) setCompilePreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, jobId, token]);

  const startUpload = async () => {
    if (!token || files.length === 0) {
      toast.error("Choose at least one file and sign in.");
      return;
    }
    try {
      setStep(1);
      let lastDocId: string | null = null;
      for (const f of files) {
        setMimeHint(f.type || "");
        const res = await uploadStandaloneOrChunked({
          file: f,
          accessToken: token,
          provenance,
        });
        lastDocId = res.uploaded_document_id;
        setJobId(lastDocId);
        const st = await pollUntilDone(lastDocId, token);
        if (st.status === "failed") {
          toast.error(st.user_safe_error || `Processing failed for ${f.name}.`);
        } else {
          toast.success(`${f.name}: extraction complete.`);
        }
      }
      if (lastDocId) {
        await loadReviewBundle(lastDocId, token);
        setStep(2);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
      setStep(0);
    }
  };

  const currentPage = review?.pages?.[pageIndex] ?? null;

  const blockKey = useCallback(
    (pageNum: number, blockIdx: number) => `${pageNum}_${blockIdx}`,
    []
  );

  const displayBlockText = useCallback(
    (blockIdx: number) => {
      if (!currentPage?.blocks?.length) return "";
      const b = currentPage.blocks[blockIdx];
      if (!b) return "";
      const key = blockKey(currentPage.page_number, blockIdx);
      if (key in blockCorrectionTexts) return blockCorrectionTexts[key];
      return b.text ?? "";
    },
    [currentPage, blockCorrectionTexts, blockKey]
  );

  const lowConfidenceBlocks = useMemo(() => {
    if (!currentPage?.blocks?.length) return 0;
    return currentPage.blocks.filter((b) => b.confidence < 0.42).length;
  }, [currentPage]);

  const updateDecision = useCallback((fieldId: string, patch: Partial<FieldDecision>) => {
    setDecisions((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        editedValue: prev[fieldId]?.editedValue ?? "",
        ...patch,
      },
    }));
  }, []);

  const runKgSearch = async (field: ReviewExtractedFieldPayload) => {
    const q = (decisions[field.id]?.editedValue ?? field.field_value).trim();
    if (q.length < 2 || !token) return;
    setSearchBusy(field.id);
    setSearchHits(null);
    try {
      const data = await fetchCidocUniversalSearch({ query: q, accessToken: token });
      setSearchHits(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setSearchBusy(null);
    }
  };

  const runDupHints = async (field: ReviewExtractedFieldPayload) => {
    const q = (decisions[field.id]?.editedValue ?? field.field_value).trim();
    if (q.length < 2 || !token) return;
    const ts = ENTITY_TYPE_SCOPE[field.entity_type];
    setDupBusy(field.id);
    try {
      const rows = await fetchEntityClusterDuplicates({
        query: q,
        accessToken: token,
        typeScope: ts,
      });
      setDupHints((prev) => ({
        ...prev,
        [field.id]: rows.map((r) => ({
          id: String(r.id),
          canonical_label: String(r.canonical_label ?? ""),
        })),
      }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Duplicate hints failed.");
    } finally {
      setDupBusy(null);
    }
  };

  const prioritizedHits = useCallback(
    (field: ReviewExtractedFieldPayload) => {
      if (!searchHits) return [];
      const preferred = ENTITY_SEARCH_PRIORITY[field.entity_type] ?? ENTITY_SEARCH_PRIORITY.OTHER;
      const ordered: { key: string; rows: unknown[] }[] = [];
      for (const k of preferred) {
        const rows = searchHits[k];
        if (Array.isArray(rows) && rows.length) ordered.push({ key: k, rows });
      }
      for (const [k, rows] of Object.entries(searchHits)) {
        if (preferred.includes(k)) continue;
        if (Array.isArray(rows) && rows.length) ordered.push({ key: k, rows });
      }
      return ordered;
    },
    [searchHits]
  );

  const validationMessages = useMemo(() => {
    const msgs: string[] = [];
    if (compilePreview?.validation_errors?.length) {
      msgs.push(...compilePreview.validation_errors);
    }
    if (!review) return msgs;
    if (lowConfidenceBlocks > 0) {
      msgs.push(
        `${lowConfidenceBlocks} OCR line(s) on this page look unreliable — verify text in the list.`
      );
    }
    for (const row of review.extracted_fields) {
      const d = decisions[row.id];
      if (row.confidence < 0.45) {
        msgs.push(`Low extraction confidence for field "${row.field_name}".`);
      }
      if (d?.uncertain && !d.linked) {
        msgs.push(
          `"${row.field_name}" marked uncertain — link an existing record or confirm text.`
        );
      }
    }
    return msgs;
  }, [review, decisions, lowConfidenceBlocks, compilePreview]);

  const flowGraph = useMemo(() => {
    if (compilePreview?.entities?.length) {
      const entities = compilePreview.entities;
      const rels = compilePreview.relations ?? [];
      const nodes: Node[] = entities.map((e, i) => ({
        id: e.id,
        position: { x: (i % 3) * 200, y: Math.floor(i / 3) * 96 },
        data: {
          label: `${e.entity_type ?? "?"}: ${(e.label ?? "").slice(0, 52)}`,
        },
        style: { fontSize: 11, width: 180 },
      }));
      const edges: Edge[] = rels.map((r, i) => ({
        id: `cp-${i}`,
        source: r.source,
        target: r.target,
        label: r.label ?? "",
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { strokeWidth: 1 },
      }));
      return { nodes, edges };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    if (!review?.extracted_fields.length) {
      nodes.push({
        id: "doc",
        position: { x: 0, y: 0 },
        data: { label: review?.file_name || "Document" },
        style: { fontSize: 12 },
      });
      return { nodes, edges };
    }
    review.extracted_fields.forEach((row, i) => {
      const d = decisions[row.id];
      const label =
        d?.linked?.label ??
        ((d?.editedValue || row.field_value).slice(0, 48) || row.field_name);
      nodes.push({
        id: row.id,
        position: { x: i * 200, y: 0 },
        data: {
          label: `${row.entity_type}: ${label}`,
        },
        style: { fontSize: 11, width: 180 },
      });
      if (i > 0) {
        const prev = review.extracted_fields[i - 1];
        edges.push({
          id: `e-${prev.id}-${row.id}`,
          source: prev.id,
          target: row.id,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 1 },
        });
      }
    });
    return { nodes, edges };
  }, [compilePreview, review, decisions]);

  const ontologyKeys = useMemo(() => {
    return Object.keys(registry.classes ?? {}).sort();
  }, [registry.classes]);

  useEffect(() => {
    if (ontologyKeys.length && !ontologyKeys.includes(ontologyHandoffKey)) {
      setOntologyHandoffKey(ontologyKeys[0] ?? "person");
    }
  }, [ontologyKeys, ontologyHandoffKey]);

  const continueHandoff = () => {
    if (!review || !token) return;
    const suggestions = reviewExtractedToSuggestions(
      review.extracted_fields.map((row) => ({
        ...row,
        field_value: decisions[row.id]?.editedValue ?? row.field_value,
      }))
    );
    const payload = {
      uploadedDocumentId: review.document_id,
      ontologyClassKey: ontologyHandoffKey,
      suggestions,
    };
    sessionStorage.setItem(INGESTION_HANDOFF_STORAGE_KEY, JSON.stringify(payload));

    const base =
      getContributePathForRegistryKey(registry, ontologyHandoffKey) ??
      `/contribute/${encodeURIComponent(ontologyHandoffKey)}`;

    router.push(`${base}?ingestionHandoff=1`);
  };

  const onFinalizeReview = async () => {
    if (!jobId || !token) return;
    try {
      await finalizeIngestionReview({ uploadedDocumentId: jobId, accessToken: token });
      toast.success("Review marked complete on the server.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not finalize.");
    }
  };

  const provenanceBanner =
    review && step >= 2 ? (
      <Card className="border-dashed">
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Source provenance</CardTitle>
          <CardDescription className="text-xs space-y-1">
            <div>
              <span className="font-medium text-foreground">File: </span>
              {review.file_name}
            </div>
            {review.provenance &&
            typeof review.provenance === "object" &&
            Object.keys(review.provenance).length ? (
              <pre className="mt-2 max-h-28 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] leading-snug">
                {JSON.stringify(review.provenance, null, 2)}
              </pre>
            ) : (
              <span>No structured provenance recorded.</span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>
    ) : null;

  const provenanceField = (key: keyof IngestionProvenance, label: string, ph?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`prov-${key}`}>{label}</Label>
      <Input
        id={`prov-${key}`}
        value={(provenance[key] as string) ?? ""}
        placeholder={ph}
        onChange={(e) =>
          setProvenance((p) => ({
            ...p,
            [key]: e.target.value,
          }))
        }
        disabled={!canRun}
      />
    </div>
  );

  const pdfMime =
    mimeHint ||
    (review?.file_name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link
          href="/contribute"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to contribute
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Supervised document ingestion</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Upload → extract → preview OCR regions → reconcile detected mentions against the knowledge
          graph → merge hints into a contribution form. Nothing is published automatically.
        </p>
        <div className="flex flex-wrap gap-2 pt-2 text-xs">
          <Link href="/contribute/ingestion/tabular" className="underline underline-offset-2">
            Spreadsheet / CSV import →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <Badge
            key={label}
            variant={step === i ? "default" : "outline"}
            className={cn(step > i && "opacity-70")}
          >
            {i + 1}. {label}
          </Badge>
        ))}
      </div>

      {provenanceBanner}

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload heritage documents</CardTitle>
            <CardDescription>
              PDF or images. Large files use chunked assembly on the server. Jobs attach to your
              account for resume via URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              {...getRootProps()}
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                !canRun && "pointer-events-none opacity-50"
              )}
            >
              <input {...getInputProps()} />
              <p className="text-sm font-medium">
                {files.length ? `${files.length} file(s) selected` : "Drag files here, or click"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, PNG, JPG, TIFF — processed one after another; server limits apply.
              </p>
            </div>
            {files.length ? (
              <ul className="max-h-36 space-y-1 overflow-auto rounded-md border p-3 text-xs">
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`} className="truncate font-mono">
                    {f.name}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              {provenanceField("source_institution", "Source institution")}
              {provenanceField("collection_name", "Collection name")}
              {provenanceField("language", "Document language")}
              {provenanceField("ocr_language", "Preferred OCR language hint")}
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="copyright_note">Copyright / usage note</Label>
                <Textarea
                  id="copyright_note"
                  value={provenance.copyright_note ?? ""}
                  placeholder="Rights, credit line, or redistribution constraints"
                  onChange={(e) =>
                    setProvenance((p) => ({ ...p, copyright_note: e.target.value }))
                  }
                  disabled={!canRun}
                  rows={3}
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={() => void startUpload()}
              disabled={!canRun || files.length === 0}
            >
              Start processing
            </Button>
            {!canRun ? (
              <p className="text-xs text-muted-foreground">Sign in with Google to upload.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Processing status</CardTitle>
            <CardDescription>
              OCR runs in the background — you can leave this page and return via your document id.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {jobId ? (
              <p>
                Job ID: <span className="font-mono text-xs">{jobId}</span>
              </p>
            ) : null}
            {pollStatus ? (
              <div className="space-y-2">
                <p>
                  Status: <Badge variant="secondary">{pollStatus.status}</Badge>
                  {pollStatus.user_safe_error ? (
                    <span className="ml-2 text-destructive">{pollStatus.user_safe_error}</span>
                  ) : null}
                </p>
                {pollStatus.processing_progress &&
                typeof pollStatus.processing_progress === "object" &&
                Object.keys(pollStatus.processing_progress).length > 0 ? (
                  <pre className="rounded-md border bg-muted/30 p-2 text-[11px] leading-snug">
                    {JSON.stringify(pollStatus.processing_progress, null, 2)}
                  </pre>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground">Waiting for status…</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>OCR preview</CardTitle>
            <CardDescription>
              Visual alignment between the rasterized page and line boxes (engine-agnostic payload).
              Edit line text to correct OCR; corrections sync to the server draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-3">
              {review && review.pages.length > 1 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Page</Label>
                  <Select
                    value={String(pageIndex)}
                    onValueChange={(v) => {
                      setPageIndex(Number.parseInt(v, 10));
                      setSelectedBlockIndex(null);
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {review.pages.map((p, idx) => (
                        <SelectItem key={p.page_number} value={String(idx)}>
                          Page {p.page_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <OcrDocumentViewer
                blobUrl={blobUrl}
                fileLabel={review?.file_name ?? ""}
                mimeHint={pdfMime}
                page={currentPage}
                pageIndex={pageIndex}
                selectedBlockIndex={selectedBlockIndex}
                onSelectBlock={setSelectedBlockIndex}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Detected lines</p>
              <ScrollArea className="h-[min(420px,50vh)] rounded-md border">
                <div className="space-y-2 p-3">
                  {currentPage?.blocks?.length ? (
                    currentPage.blocks.map((b, idx) => (
                      <button
                        key={`${idx}-${b.text.slice(0, 24)}`}
                        type="button"
                        className={cn(
                          "w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                          selectedBlockIndex === idx ? "border-primary bg-primary/10" : "bg-card",
                          b.confidence < 0.42 && "border-destructive/60"
                        )}
                        onClick={() =>
                          setSelectedBlockIndex(selectedBlockIndex === idx ? null : idx)
                        }
                      >
                        <span className="line-clamp-3">{displayBlockText(idx) || "(empty)"}</span>
                        <span className="mt-1 block text-muted-foreground">
                          {(b.confidence * 100).toFixed(0)}% confidence
                          {b.confidence < 0.42 ? " · possible OCR issue" : ""}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No geometry for this page — try extracted fields in the next step.
                    </p>
                  )}
                </div>
              </ScrollArea>
              {selectedBlockIndex !== null && currentPage ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Correct line text</Label>
                  <Textarea
                    rows={3}
                    className="text-xs"
                    value={displayBlockText(selectedBlockIndex)}
                    onChange={(e) => {
                      const key = blockKey(currentPage.page_number, selectedBlockIndex);
                      setBlockCorrectionTexts((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }));
                    }}
                  />
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader>
            <CardTitle>Semantic review & KG reconciliation</CardTitle>
            <CardDescription>
              Search existing records by detected snippets — stay at the entity level (no RDF editing).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(review?.extracted_fields.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No structured extractions for this run — you can still open a contribute form from the
                last step.
              </p>
            ) : (
              review!.extracted_fields.map((row) => (
                <div key={row.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{row.entity_type}</Badge>
                    <span className="text-xs text-muted-foreground font-mono">{row.field_name}</span>
                    <Badge variant="secondary">{(row.confidence * 100).toFixed(0)}%</Badge>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`fv-${row.id}`}>Text</Label>
                    <Textarea
                      id={`fv-${row.id}`}
                      rows={2}
                      value={decisions[row.id]?.editedValue ?? row.field_value}
                      onChange={(e) =>
                        updateDecision(row.id, { editedValue: e.target.value, uncertain: false })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={searchBusy === row.id}
                      onClick={() => void runKgSearch(row)}
                    >
                      Find KG matches
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={dupBusy === row.id}
                      onClick={() => void runDupHints(row)}
                    >
                      Cluster duplicate hints
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateDecision(row.id, {
                          uncertain: true,
                          linked: undefined,
                        })
                      }
                    >
                      Uncertain
                    </Button>
                    {decisions[row.id]?.linked ? (
                      <Badge variant="default">
                        Linked: {decisions[row.id]?.linked?.label}
                      </Badge>
                    ) : null}
                  </div>
                  {dupHints[row.id]?.length ? (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Possible identity clusters
                      </p>
                      <ul className="space-y-1 text-xs">
                        {dupHints[row.id].slice(0, 8).map((h) => (
                          <li key={h.id} className="rounded border bg-muted/20 px-2 py-1">
                            {h.canonical_label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {searchBusy === row.id ? (
                    <p className="text-xs text-muted-foreground">Searching…</p>
                  ) : null}
                  <div className="space-y-2">
                    {prioritizedHits(row).map(({ key, rows: hitRows }) => (
                      <div key={key}>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          {labelForResourceKey(key)}
                        </p>
                        <ul className="space-y-1">
                          {hitRows.slice(0, 5).map((rec) => {
                            const r = rec as Record<string, unknown>;
                            const id = typeof r.id === "number" ? r.id : Number(r.id);
                            const name =
                              (typeof r.name === "string" && r.name) ||
                              (typeof r.title === "string" && r.title) ||
                              `#${id}`;
                            if (!Number.isFinite(id)) return null;
                            return (
                              <li key={`${key}-${id}`}>
                                <button
                                  type="button"
                                  className="text-left text-xs underline-offset-2 hover:underline"
                                  onClick={() =>
                                    updateDecision(row.id, {
                                      linked: { resourceKey: key, id, label: String(name) },
                                      uncertain: false,
                                    })
                                  }
                                >
                                  {String(name)}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader>
            <CardTitle>Preview graph & validation</CardTitle>
            <CardDescription>
              Server compile-preview sketch (entities + relations). Falls back to reading-order only if
              compile is unavailable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[280px] rounded-md border bg-muted/10">
              <ReactFlowProvider>
                <ReactFlow nodes={flowGraph.nodes} edges={flowGraph.edges} fitView>
                  <Background gap={16} />
                  <Controls />
                </ReactFlow>
              </ReactFlowProvider>
            </div>
            {compilePreview?.counts_by_entity_type &&
            Object.keys(compilePreview.counts_by_entity_type).length ? (
              <p className="text-xs text-muted-foreground">
                Extracted entity types:{" "}
                {Object.entries(compilePreview.counts_by_entity_type)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            ) : null}
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Checks</p>
              {validationMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No blocking warnings detected.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-xs text-amber-900 dark:text-amber-200">
                  {validationMessages.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void onFinalizeReview()}>
                Mark review complete (server)
              </Button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-1.5 flex-1">
                <Label>Open contribute form</Label>
                <Select value={ontologyHandoffKey} onValueChange={setOntologyHandoffKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ontology class" />
                  </SelectTrigger>
                  <SelectContent>
                    {ontologyKeys.map((k) => (
                      <SelectItem key={k} value={k}>
                        {registry.classes[k]?.label ?? k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" onClick={continueHandoff}>
                Merge hints into form
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Field values merge into empty inputs only (same behavior as embedded OCR on contribute
              forms). Document id is kept for provenance.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {step === 2 ? (
          <Button type="button" onClick={() => setStep(3)}>
            Continue to semantic review
          </Button>
        ) : null}
        {step === 3 ? (
          <>
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Back to OCR preview
            </Button>
            <Button type="button" onClick={() => setStep(4)}>
              Preview graph & handoff
            </Button>
          </>
        ) : null}
        {step === 4 ? (
          <Button type="button" variant="outline" onClick={() => setStep(3)}>
            Back to semantic review
          </Button>
        ) : null}
      </div>
    </div>
  );
}
