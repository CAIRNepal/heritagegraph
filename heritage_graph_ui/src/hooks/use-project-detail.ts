"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { ApiError, getApiErrorMessage } from "@/lib/api-client";
import {
  getProject,
  listProjectActivity,
  listProjectComments,
  type ProjectActivityRow,
  type ProjectCommentRow,
  type ProjectDetail,
} from "@/lib/projects-api";

export type ProjectDetailStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "not_found"
  | "forbidden"
  | "auth_pending";

export function useProjectDetail(slug: string) {
  const { data: session, status: authStatus } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activity, setActivity] = useState<ProjectActivityRow[]>([]);
  const [comments, setComments] = useState<ProjectCommentRow[]>([]);
  const [loadStatus, setLoadStatus] = useState<ProjectDetailStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!token || !slug) {
      setLoadStatus(authStatus === "loading" ? "auth_pending" : "idle");
      return;
    }
    setLoadStatus("loading");
    setErrorMessage(null);
    try {
      const [p, a, c] = await Promise.all([
        getProject(slug, token),
        listProjectActivity(slug, token),
        listProjectComments(slug, token),
      ]);
      setProject(p);
      setActivity(a);
      setComments(c);
      setLoadStatus("ready");
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 404) {
          setLoadStatus("not_found");
          setErrorMessage("This project could not be found.");
          return;
        }
        if (e.status === 403) {
          setLoadStatus("forbidden");
          setErrorMessage("You do not have permission to view this project.");
          return;
        }
      }
      setLoadStatus("error");
      setErrorMessage(getApiErrorMessage(e));
    }
  }, [token, slug, authStatus]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    project,
    setProject,
    activity,
    setActivity,
    comments,
    setComments,
    loadStatus,
    errorMessage,
    token,
    refetch,
  };
}
