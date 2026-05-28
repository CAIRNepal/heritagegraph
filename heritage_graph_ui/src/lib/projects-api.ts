import { ApiError, apiFetch, apiFetchJson, apiUrl, formatErrorBody } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";

export interface ProjectUserBrief {
  id: string;
  username: string;
  email: string;
}

export interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  state: string;
  visibility: string;
  owner: ProjectUserBrief;
  forked_from: string | null;
  asset_count: number;
  entity_count: number;
  collaborator_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectMembershipRow {
  id: string;
  user: ProjectUserBrief;
  role: string;
  created_at: string;
}

export interface ProjectEntitySuggestion {
  label: string;
  ontology_class?: string;
  confidence?: number;
  hint?: string;
}

export interface ProjectAssetRow {
  id: string;
  media: string;
  media_url: string | null;
  media_type: string;
  role: string;
  caption: string;
  version_label?: string;
  entity_suggestions?: ProjectEntitySuggestion[];
  uploaded_by: ProjectUserBrief;
  uploaded_document_id: string | null;
  ocr_status: string;
  created_at: string;
}

export interface ProjectEntityRow {
  id: string;
  entity: string;
  entity_name: string;
  entity_category: string;
  entity_status: string;
  role_in_project: string;
  added_by: ProjectUserBrief;
  added_at: string;
}

export interface ProjectDetail extends Omit<ProjectSummary, "asset_count" | "entity_count" | "collaborator_count"> {
  intended_subject: string;
  languages: string[];
  schema_version: string;
  canvas_state: Record<string, unknown>;
  memberships: ProjectMembershipRow[];
  assets: ProjectAssetRow[];
  entities: ProjectEntityRow[];
  allowed_transitions: string[];
  can_edit: boolean;
  submitted_at: string | null;
  merged_at: string | null;
}

export interface ProjectActivityRow {
  id: string;
  actor: ProjectUserBrief | null;
  action: string;
  target_kind: string;
  target_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ProjectCommentRow {
  comment_id: string;
  user: ProjectUserBrief;
  comment: string;
  parent: string | null;
  replies: ProjectCommentRow[];
  created_at: string;
}

function authHeaders(accessToken: string, json = true): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function projectsPath(slug?: string, suffix = ""): string {
  const base = slug ? `/api/v1/data/projects/${slug}` : "/api/v1/data/projects";
  return apiUrl(`${base}${suffix}`);
}

/** DRF pagination links may point at the server's host; remap to configured API origin for browser fetches. */
export function normalizeProjectsPaginationUrl(next: string | null | undefined): string | null {
  if (!next?.trim()) return null;
  const base = getPublicApiUrl().replace(/\/$/, "");
  if (!base) {
    try {
      return new URL(next).toString();
    } catch {
      return next;
    }
  }
  try {
    const u = new URL(next);
    const origin = new URL(base).origin;
    return `${origin}${u.pathname}${u.search}`;
  } catch {
    return next.startsWith("/") ? `${base}${next}` : next;
  }
}

export interface ProjectsListPage {
  results: ProjectSummary[];
  next: string | null;
  count: number | null;
}

export async function listProjectsPage(
  accessToken: string | null | undefined,
  opts?: {
    nextUrl?: string | null;
    ordering?: string;
    visibility?: string;
    state?: string;
  }
): Promise<ProjectsListPage> {
  const ordering = opts?.ordering ?? "-updated_at";
  const params = new URLSearchParams({ ordering });
  if (opts?.visibility) params.set("visibility", opts.visibility);
  if (opts?.state) params.set("state", opts.state);

  const url =
    opts?.nextUrl && opts.nextUrl.length > 0
      ? (normalizeProjectsPaginationUrl(opts.nextUrl) ?? opts.nextUrl)
      : projectsPath(undefined, `/?${params}`);

  const headers: HeadersInit =
    accessToken != null && accessToken !== ""
      ? authHeaders(accessToken)
      : { Accept: "application/json" };

  const data = await apiFetchJson<
    ProjectSummary[] | {
      results?: ProjectSummary[];
      next?: string | null;
      count?: number;
    }
  >(url, { headers });

  if (Array.isArray(data)) {
    return {
      results: data,
      next: null,
      count: data.length,
    };
  }
  const results = data.results ?? [];
  return {
    results,
    next: normalizeProjectsPaginationUrl(data.next ?? null),
    count: data.count ?? null,
  };
}

export async function getProject(slug: string, accessToken: string): Promise<ProjectDetail> {
  return apiFetchJson<ProjectDetail>(projectsPath(slug, "/"), {
    headers: authHeaders(accessToken),
  });
}

export interface CreateProjectPayload {
  slug: string;
  title: string;
  abstract?: string;
  intended_subject?: string;
  languages?: string[];
  visibility?: string;
  tags?: string[];
}

export async function createProject(
  accessToken: string,
  payload: CreateProjectPayload,
  opts?: { idempotencyKey?: string }
): Promise<ProjectDetail> {
  const headers: Record<string, string> = {
    ...(authHeaders(accessToken) as Record<string, string>),
    ...(opts?.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
  };
  return apiFetchJson<ProjectDetail>(projectsPath(), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

export async function transitionProject(
  slug: string,
  accessToken: string,
  targetState: string,
  comment?: string
): Promise<ProjectDetail> {
  return apiFetchJson<ProjectDetail>(projectsPath(slug, "/transition/"), {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ target_state: targetState, comment: comment ?? "" }),
  });
}

export async function listProjectActivity(
  slug: string,
  accessToken: string
): Promise<ProjectActivityRow[]> {
  const data = await apiFetchJson<ProjectActivityRow[] | { results: ProjectActivityRow[] }>(
    projectsPath(slug, "/activity/"),
    { headers: authHeaders(accessToken) }
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function listProjectComments(
  slug: string,
  accessToken: string
): Promise<ProjectCommentRow[]> {
  const data = await apiFetchJson<ProjectCommentRow[] | { results: ProjectCommentRow[] }>(
    projectsPath(slug, "/comments/"),
    { headers: authHeaders(accessToken) }
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function postProjectComment(
  slug: string,
  accessToken: string,
  comment: string,
  parent?: string
): Promise<ProjectCommentRow> {
  return apiFetchJson<ProjectCommentRow>(projectsPath(slug, "/comments/"), {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ comment, parent: parent ?? null }),
  });
}

export async function rollbackProjectMerge(
  slug: string,
  accessToken: string
): Promise<ProjectDetail> {
  return apiFetchJson<ProjectDetail>(projectsPath(slug, "/rollback-merge/"), {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
}

export async function uploadProjectAsset(
  slug: string,
  accessToken: string,
  args: {
    file: File;
    role?: string;
    caption?: string;
    versionLabel?: string;
    mediaType?: string;
    runOcr?: boolean;
    onProgress?: (percent: number) => void;
  }
): Promise<ProjectAssetRow> {
  const body = new FormData();
  body.append("file", args.file);
  body.append("role", args.role ?? "evidence");
  if (args.caption) body.append("caption", args.caption);
  if (args.versionLabel?.trim())
    body.append("version_label", args.versionLabel.trim().slice(0, 120));
  if (args.mediaType) body.append("media_type", args.mediaType);
  body.append("run_ocr", args.runOcr ? "true" : "false");

  const url = projectsPath(slug, "/assets/upload/");
  const onProgress = args.onProgress;

  if (!onProgress) {
    return apiFetchJson<ProjectAssetRow>(url, {
      method: "POST",
      headers: authHeaders(accessToken, false),
      body,
    });
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((100 * e.loaded) / Math.max(e.total, 1));
        onProgress(Math.min(100, pct));
      }
    };
    xhr.onload = () => {
      let parsed: unknown = xhr.responseText;
      if (
        xhr.responseText &&
        (xhr.getResponseHeader("content-type") || "").includes("application/json")
      ) {
        try {
          parsed = JSON.parse(xhr.responseText);
        } catch {
          parsed = xhr.responseText;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(parsed as ProjectAssetRow);
        return;
      }
      const msg = formatErrorBody(parsed) ?? `Upload failed (${xhr.status}).`;
      reject(new ApiError(xhr.status, msg, parsed));
    };
    xhr.onerror = () => reject(new ApiError(0, "Upload failed."));
    xhr.send(body);
  });
}

export async function startProjectAssetOcr(
  slug: string,
  assetId: string,
  accessToken: string,
  confirmVision?: boolean
): Promise<ProjectAssetRow> {
  return apiFetchJson<ProjectAssetRow>(
    projectsPath(slug, `/assets/${assetId}/start-ocr/`),
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: JSON.stringify({
        confirm_vision: confirmVision ?? false,
      }),
    }
  );
}

export async function deleteProjectAsset(
  slug: string,
  assetId: string,
  accessToken: string
): Promise<void> {
  await apiFetch(projectsPath(slug, `/assets/${assetId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export async function linkProjectEntity(
  slug: string,
  accessToken: string,
  entityId: string,
  roleInProject?: string
): Promise<ProjectEntityRow> {
  return apiFetchJson<ProjectEntityRow>(projectsPath(slug, "/entities/"), {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({
      entity: entityId,
      role_in_project: roleInProject ?? "",
    }),
  });
}

export interface ProjectGraphNode {
  id: string;
  label: string;
  category: string;
  entityType: string;
  description: string;
  apiEndpoint: string;
  roleInProject?: string;
  status?: string;
  rawData: Record<string, unknown>;
}

export interface ProjectGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  edgeType: string;
}

export interface ProjectGraphPayload {
  nodes: ProjectGraphNode[];
  edges: ProjectGraphEdge[];
  isDemo?: boolean;
}

export async function fetchProjectGraph(
  slug: string,
  accessToken?: string
): Promise<ProjectGraphPayload> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return apiFetchJson<ProjectGraphPayload>(projectsPath(slug, "/graph/"), { headers });
}

export async function unlinkProjectEntity(
  slug: string,
  linkId: string,
  accessToken: string
): Promise<void> {
  await apiFetch(projectsPath(slug, `/entities/${linkId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export async function addProjectMembership(
  slug: string,
  accessToken: string,
  args: { username: string; role: string }
): Promise<ProjectMembershipRow> {
  return apiFetchJson<ProjectMembershipRow>(projectsPath(slug, "/memberships/"), {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify(args),
  });
}

export async function removeProjectMembership(
  slug: string,
  membershipId: string,
  accessToken: string
): Promise<void> {
  await apiFetch(projectsPath(slug, `/memberships/${membershipId}/`), {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export const PROJECT_STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  needs_revision: "Needs Revision",
  approved: "Approved",
  merged: "Merged",
  withdrawn: "Withdrawn",
};

export const PROJECT_TRANSITION_LABELS: Record<string, string> = {
  in_review: "Submit for Review",
  withdrawn: "Withdraw",
  approved: "Approve",
  needs_revision: "Request Revision",
  merged: "Merge",
  draft: "Reopen as Draft",
};
