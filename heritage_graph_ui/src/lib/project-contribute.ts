"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import {
  buildPatternCompletionUrl,
  parseSemanticWorkflowParams,
} from "@/lib/semantic-workflow-params";
import { getApiErrorMessage } from "@/lib/api-client";
import { getProject, linkProjectEntity } from "@/lib/projects-api";

export const PROJECT_QUERY_PARAM = "project";
export const OCR_DOC_QUERY_PARAM = "ocrDoc";

/** Append or replace `?project=` on a contribute route. */
export function appendProjectToRoute(route: string, projectSlug: string): string {
  const slug = projectSlug.trim();
  if (!slug) return route;
  const qIdx = route.indexOf("?");
  const path = qIdx >= 0 ? route.slice(0, qIdx) : route;
  const params = new URLSearchParams(qIdx >= 0 ? route.slice(qIdx + 1) : "");
  params.set(PROJECT_QUERY_PARAM, slug);
  return params.toString() ? `${path}?${params.toString()}` : path;
}

export function projectWorkspacePath(projectSlug: string): string {
  return `/contribute/projects/${encodeURIComponent(projectSlug.trim())}`;
}

export function projectGraphPath(projectSlug: string): string {
  return `${projectWorkspacePath(projectSlug)}/graph`;
}

/** Knowledge view for a cultural entity linked to a project. */
export function culturalEntityKnowledgePath(entityId: string): string {
  return `/knowledge/entity/view/${encodeURIComponent(entityId)}`;
}

export interface ProjectContributeContext {
  projectSlug: string | null;
  projectTitle: string | null;
  ocrDocumentId: string | null;
  redirectTo: string | undefined;
  onContributionCreated:
    | ((result: { id: string }) => Promise<void>)
    | undefined;
}

export function useProjectContributeContext(): ProjectContributeContext {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const projectSlug = searchParams.get(PROJECT_QUERY_PARAM)?.trim() || null;
  const ocrDocumentId = searchParams.get(OCR_DOC_QUERY_PARAM)?.trim() || null;
  const wf = parseSemanticWorkflowParams(searchParams);

  const [projectTitle, setProjectTitle] = useState<string | null>(null);

  useEffect(() => {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (!projectSlug || !token) {
      setProjectTitle(null);
      return;
    }
    getProject(projectSlug, token)
      .then((p) => setProjectTitle(p.title))
      .catch(() => setProjectTitle(null));
  }, [projectSlug, session]);

  const redirectTo = useMemo(() => {
    if (projectSlug) return projectWorkspacePath(projectSlug);
    if (wf) return buildPatternCompletionUrl(wf.patternKey, wf.stepOrder, projectSlug);
    return undefined;
  }, [projectSlug, wf]);

  const onContributionCreated = useCallback(
    async (result: { id: string }) => {
      if (!projectSlug) return;
      const token = (session as { accessToken?: string } | null)?.accessToken;
      if (!token) return;
      try {
        await linkProjectEntity(projectSlug, token, result.id);
        toast.success("Linked to your project.");
        router.push(projectWorkspacePath(projectSlug));
      } catch (e) {
        toast.error(getApiErrorMessage(e, "Created, but could not link to project."));
        if (redirectTo) router.push(redirectTo);
      }
    },
    [projectSlug, session, router, redirectTo]
  );

  return {
    projectSlug,
    projectTitle,
    ocrDocumentId,
    redirectTo,
    onContributionCreated: projectSlug ? onContributionCreated : undefined,
  };
}
