import { getPublicApiUrl } from "@/lib/api-base";
import { ApiError } from "@/lib/api-client";

/** Same shape as `OcrFieldSuggestion` — duplicated here to avoid importing client hooks from shared lib. */
export type IngestionSuggestionPayload = {
  value: string;
  confidence: number;
  entityType?: string;
  fieldName?: string;
  source?: string;
};

export type IngestionProvenance = {
  source_institution?: string;
  collection_name?: string;
  language?: string;
  ocr_language?: string;
  copyright_note?: string;
};

export type OcrBlockPayload = {
  text: string;
  bbox: [number, number, number, number];
  confidence: number;
};

export type ReviewPagePayload = {
  page_number: number;
  raw_text: string;
  confidence: number;
  blocks: OcrBlockPayload[];
  image_width: number | null;
  image_height: number | null;
};

export type ReviewExtractedFieldPayload = {
  id: string;
  field_name: string;
  field_value: string;
  confidence: number;
  entity_type: string;
  vocabulary_match_score: number | null;
};

export type SavedFieldDecisionPayload = {
  edited_value?: string;
  uncertain?: boolean;
  linked?: {
    resource_key: string;
    id: number;
    label?: string;
  } | null;
};

export type SavedReviewStatePayload = {
  field_decisions?: Record<string, SavedFieldDecisionPayload>;
  block_corrections?: Record<string, { corrected_text?: string }>;
  ontology_handoff_key?: string;
  finalized_at?: string | null;
};

export type ReviewPayload = {
  document_id: string;
  status: string;
  document_type?: string;
  classification_confidence?: number;
  processing_started?: string | null;
  processing_finished?: string | null;
  user_safe_error?: string | null;
  raw_text: string;
  provenance: Record<string, unknown>;
  file_name: string;
  pages: ReviewPagePayload[];
  extracted_fields: ReviewExtractedFieldPayload[];
  saved_review_state?: SavedReviewStatePayload;
};

/** Prefer chunked assembly server-side above this size (bytes). */
export const STANDALONE_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;

export type CompilePreviewEntityPayload = {
  id: string;
  kind?: string;
  label?: string;
  entity_type?: string;
  field_name?: string;
  confidence?: number;
  uncertain?: boolean;
  linked?: Record<string, unknown> | null;
};

export type CompilePreviewRelationPayload = {
  source: string;
  target: string;
  label?: string;
  confidence?: number;
};

export type DocumentCompilePreviewPayload = {
  document_id: string;
  entities: CompilePreviewEntityPayload[];
  relations: CompilePreviewRelationPayload[];
  validation_errors: string[];
  counts_by_entity_type: Record<string, number>;
  provenance: Record<string, unknown>;
};

export type TabularImportJobPayload = {
  id: string;
  status: string;
  source_filename: string;
  provenance: Record<string, unknown>;
  column_mapping: Record<string, string>;
  staged_rows: Record<string, string>[];
  row_review_state: Record<string, unknown>;
  validation_errors: string[];
  user_safe_error?: string;
  created_at?: string;
  updated_at?: string;
};

export const INGESTION_HANDOFF_STORAGE_KEY = "heritagegraph_ingestion_handoff";

export type IngestionHandoffPayload = {
  uploadedDocumentId: string;
  ontologyClassKey: string;
  suggestions: Record<string, IngestionSuggestionPayload>;
};

export function buildVersionedOcrBaseUrl(): string {
  const api = getPublicApiUrl();
  if (!api) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
  return `${api}/api/v1/data`;
}

export async function uploadStandaloneIngestionDocument(args: {
  file: File;
  accessToken: string;
  provenance?: IngestionProvenance;
  mediaType?: string;
  description?: string;
}): Promise<{ media_id: number; uploaded_document_id: string; status: string }> {
  const base = buildVersionedOcrBaseUrl();
  const body = new FormData();
  body.append("file", args.file);
  body.append("standalone_ingestion", "true");
  body.append("media_type", args.mediaType ?? "image");
  if (args.description) body.append("description", args.description);
  if (args.provenance?.source_institution) {
    body.append("source_institution", args.provenance.source_institution);
  }
  if (args.provenance?.collection_name) {
    body.append("collection_name", args.provenance.collection_name);
  }
  if (args.provenance?.language) {
    body.append("language", args.provenance.language);
  }
  if (args.provenance?.ocr_language) {
    body.append("ocr_language", args.provenance.ocr_language);
  }
  if (args.provenance?.copyright_note) {
    body.append("copyright_note", args.provenance.copyright_note);
  }

  const res = await fetch(`${base}/ocr-documents/upload/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
    },
    body,
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as {
    media_id: number;
    uploaded_document_id: string;
    status: string;
  };
}

export async function fetchOcrReviewPayload(args: {
  uploadedDocumentId: string;
  accessToken: string;
}): Promise<ReviewPayload> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(`${base}/ocr-documents/${args.uploadedDocumentId}/review/`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as ReviewPayload;
}

export async function fetchOcrAssetBlob(args: {
  uploadedDocumentId: string;
  accessToken: string;
}): Promise<Blob> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(`${base}/ocr-documents/${args.uploadedDocumentId}/asset/`, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
    },
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return res.blob();
}

export async function fetchCidocUniversalSearch(args: {
  query: string;
  accessToken?: string | null;
}): Promise<Record<string, unknown[]>> {
  const api = getPublicApiUrl();
  if (!api) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  const qs = new URLSearchParams({ q: args.query.trim() });
  const headers: Record<string, string> = { Accept: "application/json" };
  if (args.accessToken) headers.Authorization = `Bearer ${args.accessToken}`;
  const res = await fetch(`${api}/api/v1/cidoc/search/?${qs.toString()}`, {
    headers,
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  const data = (await res.json()) as Record<string, unknown[]>;
  return data;
}

export function reviewExtractedToSuggestions(
  fields: ReviewExtractedFieldPayload[]
): Record<string, IngestionSuggestionPayload> {
  const out: Record<string, IngestionSuggestionPayload> = {};
  for (const row of fields) {
    const key = row.field_name?.trim();
    if (!key) continue;
    out[key] = {
      value: row.field_value,
      confidence: row.confidence,
      entityType: row.entity_type,
      fieldName: row.field_name,
      source: "ner_v1",
    };
  }
  return out;
}

export async function patchIngestionReviewState(args: {
  uploadedDocumentId: string;
  accessToken: string;
  patch: SavedReviewStatePayload;
}): Promise<SavedReviewStatePayload> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(`${base}/ocr-documents/${args.uploadedDocumentId}/review-state/`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify(args.patch),
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as SavedReviewStatePayload;
}

export async function finalizeIngestionReview(args: {
  uploadedDocumentId: string;
  accessToken: string;
}): Promise<{ detail: string; ingestion_review_state: SavedReviewStatePayload }> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(`${base}/ocr-documents/${args.uploadedDocumentId}/finalize-review/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as { detail: string; ingestion_review_state: SavedReviewStatePayload };
}

export async function fetchDocumentCompilePreview(args: {
  uploadedDocumentId: string;
  accessToken: string;
}): Promise<DocumentCompilePreviewPayload> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(`${base}/ocr-documents/${args.uploadedDocumentId}/compile-preview/`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as DocumentCompilePreviewPayload;
}

export async function fetchEntityClusterDuplicates(args: {
  query: string;
  accessToken: string;
  typeScope?: string;
}): Promise<
  {
    id: string;
    canonical_label: string;
    type_scope: string;
    curated_aliases: string[];
    external_identifiers: Record<string, unknown>;
  }[]
> {
  const api = getPublicApiUrl();
  if (!api) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  const qs = new URLSearchParams({ q: args.query.trim() });
  if (args.typeScope) qs.set("type_scope", args.typeScope);
  const res = await fetch(`${api}/api/v1/cidoc/entity-clusters/suggest-duplicates/?${qs}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  const data = (await res.json()) as { results?: unknown[] };
  return Array.isArray(data.results) ? (data.results as never[]) : [];
}

export async function createChunkedUploadSession(args: {
  filename: string;
  byteSize: number;
  accessToken: string;
  provenance?: IngestionProvenance;
  mediaType?: string;
  description?: string;
}): Promise<{ id: string; bytes_written: number; expected_bytes: number }> {
  const base = buildVersionedOcrBaseUrl();
  const body: Record<string, unknown> = {
    filename: args.filename,
    byte_size: args.byteSize,
    media_type: args.mediaType ?? "image",
    description: args.description ?? "",
  };
  const p = args.provenance;
  if (p?.source_institution) body.source_institution = p.source_institution;
  if (p?.collection_name) body.collection_name = p.collection_name;
  if (p?.language) body.language = p.language;
  if (p?.ocr_language) body.ocr_language = p.ocr_language;
  if (p?.copyright_note) body.copyright_note = p.copyright_note;

  const res = await fetch(`${base}/ocr-chunk-uploads/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as { id: string; bytes_written: number; expected_bytes: number };
}

export async function appendChunkedUploadPart(args: {
  sessionId: string;
  accessToken: string;
  chunk: Blob;
}): Promise<{ id: string; bytes_written: number; expected_bytes: number }> {
  const base = buildVersionedOcrBaseUrl();
  const fd = new FormData();
  fd.append("chunk", args.chunk, "part.bin");
  const res = await fetch(`${base}/ocr-chunk-uploads/${args.sessionId}/append/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: fd,
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as { id: string; bytes_written: number; expected_bytes: number };
}

export async function completeChunkedUpload(args: {
  sessionId: string;
  accessToken: string;
}): Promise<{ media_id: number; uploaded_document_id: string; status: string }> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(`${base}/ocr-chunk-uploads/${args.sessionId}/complete/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as { media_id: number; uploaded_document_id: string; status: string };
}

export async function uploadStandaloneOrChunked(args: {
  file: File;
  accessToken: string;
  provenance?: IngestionProvenance;
  mediaType?: string;
  description?: string;
  chunkBytes?: number;
}): Promise<{ media_id: number; uploaded_document_id: string; status: string }> {
  const chunkSize = args.chunkBytes ?? STANDALONE_UPLOAD_MAX_BYTES;
  if (args.file.size <= chunkSize) {
    return uploadStandaloneIngestionDocument({
      file: args.file,
      accessToken: args.accessToken,
      provenance: args.provenance,
      mediaType: args.mediaType,
      description: args.description,
    });
  }
  const session = await createChunkedUploadSession({
    filename: args.file.name,
    byteSize: args.file.size,
    accessToken: args.accessToken,
    provenance: args.provenance,
    mediaType: args.mediaType,
    description: args.description,
  });
  let offset = 0;
  while (offset < args.file.size) {
    const end = Math.min(offset + chunkSize, args.file.size);
    const blob = args.file.slice(offset, end);
    await appendChunkedUploadPart({
      sessionId: session.id,
      accessToken: args.accessToken,
      chunk: blob,
    });
    offset = end;
  }
  return completeChunkedUpload({
    sessionId: session.id,
    accessToken: args.accessToken,
  });
}

export async function createTabularImportJob(args: {
  file: File;
  accessToken: string;
  provenance?: Pick<
    IngestionProvenance,
    "source_institution" | "collection_name" | "language"
  >;
}): Promise<TabularImportJobPayload> {
  const base = buildVersionedOcrBaseUrl();
  const fd = new FormData();
  fd.append("file", args.file);
  const p = args.provenance;
  if (p?.source_institution) fd.append("source_institution", p.source_institution);
  if (p?.collection_name) fd.append("collection_name", p.collection_name);
  if (p?.language) fd.append("language", p.language);
  const res = await fetch(`${base}/tabular-import-jobs/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: fd,
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as TabularImportJobPayload;
}

export async function patchTabularImportJob(args: {
  jobId: string;
  accessToken: string;
  patch: {
    column_mapping?: Record<string, string>;
    row_review_state?: Record<string, Record<string, unknown> | null>;
    provenance?: Record<string, unknown>;
  };
}): Promise<TabularImportJobPayload> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(`${base}/tabular-import-jobs/${args.jobId}/`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify(args.patch),
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as TabularImportJobPayload;
}

export async function fetchTabularCompilePreview(args: {
  jobId: string;
  accessToken: string;
}): Promise<DocumentCompilePreviewPayload & { tabular_job_id?: string; mapping?: Record<string, string>; row_count?: number }> {
  const base = buildVersionedOcrBaseUrl();
  const res = await fetch(`${base}/tabular-import-jobs/${args.jobId}/compile-preview/`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
  });
  if (!res.ok) {
    throw await ApiError.fromResponse(res);
  }
  return (await res.json()) as DocumentCompilePreviewPayload & {
    tabular_job_id?: string;
    mapping?: Record<string, string>;
    row_count?: number;
  };
}
