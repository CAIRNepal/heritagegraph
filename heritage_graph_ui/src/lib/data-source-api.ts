export const SOURCE_TYPE_OPTIONS = [
  { value: "archival", label: "Archival Record" },
  { value: "field_survey", label: "Field Survey Dataset" },
  { value: "oral_history", label: "Oral History Recording" },
  { value: "image", label: "Image Dataset" },
  { value: "pdf", label: "PDF Document" },
  { value: "published", label: "Published Source" },
  { value: "inscription", label: "Inscription" },
  { value: "web", label: "Web Resource" },
] as const;

export type SourceType = (typeof SOURCE_TYPE_OPTIONS)[number]["value"];

export const ACCESS_TIER_OPTIONS = [
  { value: "public", label: "Public — no restrictions" },
  { value: "org_only", label: "Organization only" },
  { value: "community_only", label: "Community only" },
  { value: "sensitive_indigenous", label: "Sensitive / Indigenous knowledge" },
] as const;

export type AccessTier = (typeof ACCESS_TIER_OPTIONS)[number]["value"];

export const DATACITE_RESOURCE_TYPES = [
  "Dataset",
  "Image",
  "Sound",
  "Text",
  "PhysicalObject",
  "Collection",
  "Software",
] as const;

export type DataCiteResourceType = (typeof DATACITE_RESOURCE_TYPES)[number];

export const KNOWN_TK_LABELS = [
  {
    uri: "https://localcontexts.org/labels/tk-attribution/",
    label: "TK Attribution",
  },
  {
    uri: "https://localcontexts.org/labels/tk-clan/",
    label: "TK Clan",
  },
  {
    uri: "https://localcontexts.org/labels/tk-family/",
    label: "TK Family",
  },
  {
    uri: "https://localcontexts.org/labels/tk-multiple-community/",
    label: "TK Multiple Community",
  },
  {
    uri: "https://localcontexts.org/labels/tk-community-voice/",
    label: "TK Community Voice",
  },
  {
    uri: "https://localcontexts.org/labels/tk-creative/",
    label: "TK Creative",
  },
  {
    uri: "https://localcontexts.org/labels/tk-verified/",
    label: "TK Verified",
  },
  {
    uri: "https://localcontexts.org/labels/tk-non-verified/",
    label: "TK Non-Verified",
  },
  {
    uri: "https://localcontexts.org/labels/tk-seasonal/",
    label: "TK Seasonal",
  },
  {
    uri: "https://localcontexts.org/labels/tk-women-general/",
    label: "TK Women General",
  },
  {
    uri: "https://localcontexts.org/labels/tk-men-general/",
    label: "TK Men General",
  },
  {
    uri: "https://localcontexts.org/labels/tk-secret/",
    label: "TK Secret / Sacred",
  },
] as const;

export interface DataSourceSummary {
  id: string;
  name: string;
  author: string;
  source_type: SourceType;
  access_tier: AccessTier;
  access_tier_display: string;
  ingest_status: "pending" | "processing" | "ready" | "failed";
  ingest_status_display: string;
  pid: string;
  created_at: string;
  updated_at: string;
  hg_class: string;
}

export interface DataSourceDetail extends DataSourceSummary {
  citation: string;
  url: string;
  note: string;
  iiif_manifest: Record<string, unknown> | null;
  iiif_manifest_url: string;
  datacite_identifier: string;
  datacite_creator: string;
  datacite_publisher: string;
  datacite_publication_year: number | null;
  datacite_resource_type: DataCiteResourceType;
  care_labels: string[];
  contributed_by: number | null;
}

export interface CreateDataSourcePayload {
  name: string;
  source_type: SourceType;
  author?: string;
  citation?: string;
  url?: string;
  note?: string;
  access_tier?: AccessTier;
  care_labels?: string[];
  datacite_identifier?: string;
  datacite_creator?: string;
  datacite_publisher?: string;
  datacite_publication_year?: number | null;
  datacite_resource_type?: DataCiteResourceType;
}

export interface DataSourceListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DataSourceSummary[];
}

const API = process.env.NEXT_PUBLIC_API_URL;

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function listDataSources(
  token: string,
  params?: {
    source_type?: SourceType;
    access_tier?: AccessTier;
    ingest_status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<DataSourceListResponse> {
  const qs = new URLSearchParams();
  if (params?.source_type) qs.set("source_type", params.source_type);
  if (params?.access_tier) qs.set("access_tier", params.access_tier);
  if (params?.ingest_status) qs.set("ingest_status", params.ingest_status);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));

  const res = await fetch(`${API}/cidoc/data-sources/?${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to list data sources: ${res.status}`);
  return res.json();
}

export async function getDataSource(
  token: string,
  id: string
): Promise<DataSourceDetail> {
  const res = await fetch(`${API}/cidoc/data-sources/${id}/`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch data source: ${res.status}`);
  return res.json();
}

export async function createDataSource(
  token: string,
  payload: CreateDataSourcePayload,
  file?: File
): Promise<DataSourceDetail> {
  const form = new FormData();
  Object.entries(payload).forEach(([k, v]) => {
    if (v == null) return;
    if (Array.isArray(v)) {
      form.append(k, JSON.stringify(v));
    } else {
      form.append(k, String(v));
    }
  });
  if (file) form.append("uploaded_file", file);

  const res = await fetch(`${API}/cidoc/data-sources/`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error("Upload failed"), { status: res.status, body: err });
  }
  return res.json();
}

export async function deleteDataSource(
  token: string,
  id: string
): Promise<void> {
  const res = await fetch(`${API}/cidoc/data-sources/${id}/`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok && res.status !== 204)
    throw new Error(`Failed to delete data source: ${res.status}`);
}

export function ingestStatusColor(
  status: DataSourceSummary["ingest_status"]
): string {
  return (
    {
      pending: "bg-muted text-muted-foreground",
      processing: "bg-brand-blue/10 text-brand-blue",
      ready: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    }[status] ?? "bg-muted text-muted-foreground"
  );
}
