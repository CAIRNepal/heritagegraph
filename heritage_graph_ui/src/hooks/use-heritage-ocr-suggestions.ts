"use client";

import { useCallback, useRef } from "react";
import { getPublicApiUrl } from "@/lib/api-base";

export type OcrFieldSuggestion = {
  value: string;
  confidence: number;
  entityType?: string;
  fieldName?: string;
  source?: string;
};

export type OcrDocumentStatus = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  document_type?: string;
  classification_confidence?: number;
  processing_started?: string | null;
  processing_finished?: string | null;
  user_safe_error?: string | null;
  raw_text?: string;
  processing_progress?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
};

export function buildVersionedOcrBaseUrl() {
  const api = getPublicApiUrl();
  if (!api) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
  return `${api}/api/v1/data`;
}

export async function uploadHeritageOcrDocument(args: {
  file: File;
  culturalEntityId: string;
  accessToken: string;
  mediaType?: string;
  description?: string;
  provenance?: {
    source_institution?: string;
    collection_name?: string;
    language?: string;
    ocr_language?: string;
    copyright_note?: string;
  };
}): Promise<{ media_id: number; uploaded_document_id: string; status: string }> {
  const base = buildVersionedOcrBaseUrl();
  const body = new FormData();
  body.append("file", args.file);
  body.append("cultural_entity_id", args.culturalEntityId);
  if (args.mediaType) body.append("media_type", args.mediaType);
  if (args.description) body.append("description", args.description);
  const pv = args.provenance;
  if (pv?.source_institution) body.append("source_institution", pv.source_institution);
  if (pv?.collection_name) body.append("collection_name", pv.collection_name);
  if (pv?.language) body.append("language", pv.language);
  if (pv?.ocr_language) body.append("ocr_language", pv.ocr_language);
  if (pv?.copyright_note) body.append("copyright_note", pv.copyright_note);

  const res = await fetch(`${base}/ocr-documents/upload/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload failed (${res.status})`);
  }
  return (await res.json()) as {
    media_id: number;
    uploaded_document_id: string;
    status: string;
  };
}

export async function fetchOcrStatus(args: {
  uploadedDocumentId: string;
  accessToken: string;
}): Promise<OcrDocumentStatus> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(`${base}/ocr-documents/${args.uploadedDocumentId}/`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Status fetch failed (${res.status})`);
  }
  return (await res.json()) as OcrDocumentStatus;
}

export async function fetchOcrSuggestions(args: {
  uploadedDocumentId: string;
  accessToken: string;
}): Promise<Record<string, OcrFieldSuggestion>> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(
    `${base}/ocr-documents/${args.uploadedDocumentId}/suggestions/`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.accessToken}`,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Suggestions fetch failed (${res.status})`);
  }
  return (await res.json()) as Record<string, OcrFieldSuggestion>;
}

/**
 * Small helper to poll `pending/processing` until completion, then return suggestions.
 */
export function useHeritageOcrRun() {
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const run = useCallback(
    async (args: {
      uploadedDocumentId: string;
      accessToken: string;
      onStatus?: (s: OcrDocumentStatus) => void;
    }): Promise<{ status: OcrDocumentStatus; suggestions: Record<string, OcrFieldSuggestion> }> => {
      clear();
      const maxAttempts = 120; // ~3 minutes at 1.5s
      for (let i = 0; i < maxAttempts; i++) {
        const st = await fetchOcrStatus({
          uploadedDocumentId: args.uploadedDocumentId,
          accessToken: args.accessToken,
        });
        args.onStatus?.(st);
        if (st.status === "failed") {
          const suggestions = await fetchOcrSuggestions({
            uploadedDocumentId: args.uploadedDocumentId,
            accessToken: args.accessToken,
          }).catch(() => ({}));
          return { status: st, suggestions };
        }
        if (st.status === "completed") {
          const suggestions = await fetchOcrSuggestions({
            uploadedDocumentId: args.uploadedDocumentId,
            accessToken: args.accessToken,
          });
          return { status: st, suggestions };
        }
        await new Promise((r) => {
          window.setTimeout(r, 1500);
        });
      }
      throw new Error("Timed out waiting for OCR to finish.");
    },
    [clear]
  );

  return { run, clear };
}
