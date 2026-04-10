import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ───────────────────────────────────────────────────────────

export interface ReactionSummary {
  upvotes: number;
  downvotes: number;
  user_reaction: "upvote" | "downvote" | null;
}

export interface Comment {
  comment_id: string;
  id: number;
  submission: string;
  user: {
    id: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  comment: string;
  parent: number | null;
  created_at: string;
  updated_at: string;
  replies: Comment[];
  reaction_summary: ReactionSummary;
}

export interface ForkInfo {
  id: string;
  original_entity: string;
  forked_entity: string;
  forked_entity_id: string;
  forked_entity_name: string;
  forked_entity_status: string;
  original_entity_name: string;
  forked_by: { id: number; username: string };
  reason: string;
  fork_reason_tag: string;
  fork_reason_tag_display: string;
  fork_status: string;
  fork_status_display: string;
  diff_summary: Record<string, { old: any; new: any }>;
  diff_field_count: number;
  merged_at: string | null;
  merged_by: number | null;
  merged_by_username: string | null;
  created_at: string;
}

export interface ForkLineageNode {
  entity_id: string;
  name: string;
  status: string;
  category: string;
  contributor_username: string;
  fork_depth: number;
  is_fork: boolean;
  fork_info: {
    fork_id: string;
    reason: string;
    fork_reason_tag: string;
    fork_status: string;
    diff_field_count: number;
    diff_fields: string[];
    forked_by: string;
    created_at: string;
  } | null;
  children: ForkLineageNode[];
  created_at: string;
}

export interface CrossEntityDiff {
  entity_id: string;
  entity_name: string;
  fork_entity_id: string;
  fork_entity_name: string;
  entity_revision: any;
  fork_revision: any;
  diff: Record<string, { old: any; new: any }>;
}

export interface RevisionDiff {
  entity_id: string;
  entity_name: string;
  revision_from: any;
  revision_to: any;
  diff: Record<string, { old: any; new: any }>;
}

// ─── useReactions ─────────────────────────────────────────────────────

export function useReactions() {
  const { data: session } = useSession();

  const getHeaders = useCallback(() => {
    const token = (session as any)?.accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [session]);

  const toggleReaction = useCallback(
    async (
      reactionType: "upvote" | "downvote",
      entityId?: string,
      commentId?: string
    ) => {
      return apiFetchJson(`${API_BASE_URL}/data/api/reactions/toggle/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          reaction_type: reactionType,
          ...(entityId ? { entity_id: entityId } : {}),
          ...(commentId ? { comment_id: commentId } : {}),
        }),
      });
    },
    [getHeaders]
  );

  const getSummary = useCallback(
    async (entityId?: string, commentId?: string): Promise<ReactionSummary> => {
      const params = entityId
        ? `entity_id=${entityId}`
        : `comment_id=${commentId}`;
      return apiFetchJson(
        `${API_BASE_URL}/data/api/reactions/summary/?${params}`,
        { headers: getHeaders() }
      );
    },
    [getHeaders]
  );

  return { toggleReaction, getSummary };
}

// ─── useComments ──────────────────────────────────────────────────────

export function useComments(entityId: string) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  const getHeaders = useCallback(() => {
    const token = (session as any)?.accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [session]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchJson<{ results?: Comment[] } | Comment[]>(
        `${API_BASE_URL}/data/api/entities/${entityId}/comments/`,
        { headers: getHeaders() }
      );
      setComments(Array.isArray(data) ? data : data.results || []);
    } catch (e) {
      setComments([]);
      toast.error(getApiErrorMessage(e, "Could not load comments."));
    } finally {
      setLoading(false);
    }
  }, [entityId, getHeaders]);

  const addComment = useCallback(
    async (text: string, parentId?: number) => {
      const newComment = await apiFetchJson<Comment>(
        `${API_BASE_URL}/data/api/entities/${entityId}/comments/`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            comment: text,
            ...(parentId ? { parent: parentId } : {}),
          }),
        }
      );
      await fetchComments(); // refresh
      return newComment;
    },
    [entityId, getHeaders, fetchComments]
  );

  const deleteComment = useCallback(
    async (commentPk: number) => {
      await apiFetchJson(
        `${API_BASE_URL}/data/api/entities/${entityId}/comments/${commentPk}/`,
        { method: "DELETE", headers: getHeaders() }
      );
      await fetchComments();
    },
    [entityId, getHeaders, fetchComments]
  );

  return { comments, loading, fetchComments, addComment, deleteComment };
}

// ─── useForks ──────────────────────────────────────────────────────────

export function useForks() {
  const { data: session } = useSession();

  const getHeaders = useCallback(() => {
    const token = (session as any)?.accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [session]);

  const forkEntity = useCallback(
    async (
      entityId: string,
      reason: string = "",
      forkReasonTag: string = "other",
      changes: Record<string, any> = {},
    ) => {
      return apiFetchJson(`${API_BASE_URL}/data/api/forks/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          entity_id: entityId,
          reason,
          fork_reason_tag: forkReasonTag,
          changes,
        }),
      });
    },
    [getHeaders]
  );

  const listForks = useCallback(
    async (entityId: string): Promise<ForkInfo[]> => {
      return apiFetchJson(
        `${API_BASE_URL}/data/api/forks/?entity_id=${entityId}`,
        { headers: getHeaders() }
      );
    },
    [getHeaders]
  );

  const getLineage = useCallback(
    async (entityId: string): Promise<ForkLineageNode> => {
      return apiFetchJson(
        `${API_BASE_URL}/data/api/cultural-entities/${entityId}/lineage/`,
        { headers: getHeaders() }
      );
    },
    [getHeaders]
  );

  const getForkDiff = useCallback(
    async (entityId: string, forkEntityId: string): Promise<CrossEntityDiff> => {
      return apiFetchJson(
        `${API_BASE_URL}/data/api/cultural-entities/${entityId}/fork-diff/${forkEntityId}/`,
        { headers: getHeaders() }
      );
    },
    [getHeaders]
  );

  const mergeFork = useCallback(
    async (forkId: string) => {
      return apiFetchJson(`${API_BASE_URL}/data/api/forks/${forkId}/merge/`, {
        method: "POST",
        headers: getHeaders(),
      });
    },
    [getHeaders]
  );

  const promoteFork = useCallback(
    async (forkId: string) => {
      return apiFetchJson(`${API_BASE_URL}/data/api/forks/${forkId}/promote/`, {
        method: "POST",
        headers: getHeaders(),
      });
    },
    [getHeaders]
  );

  const rejectFork = useCallback(
    async (forkId: string, reason: string) => {
      return apiFetchJson(`${API_BASE_URL}/data/api/forks/${forkId}/reject/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });
    },
    [getHeaders]
  );

  return {
    forkEntity,
    listForks,
    getLineage,
    getForkDiff,
    mergeFork,
    promoteFork,
    rejectFork,
  };
}

// ─── useRevisionDiff ──────────────────────────────────────────────────

export function useRevisionDiff() {
  const { data: session } = useSession();

  const getHeaders = useCallback(() => {
    const token = (session as any)?.accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [session]);

  const getDiff = useCallback(
    async (entityId: string, fromRev: number, toRev: number): Promise<RevisionDiff> => {
      return apiFetchJson(
        `${API_BASE_URL}/data/api/entities/${entityId}/diff/?from=${fromRev}&to=${toRev}`,
        { headers: getHeaders() }
      );
    },
    [getHeaders]
  );

  return { getDiff };
}

// ─── useSharing ──────────────────────────────────────────────────────

export function useSharing() {
  const { data: session } = useSession();

  const getHeaders = useCallback(() => {
    const token = (session as any)?.accessToken;
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [session]);

  const trackShare = useCallback(
    async (entityId: string, platform: string) => {
      try {
        await fetch(`${API_BASE_URL}/data/api/shares/`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({ entity_id: entityId, platform }),
        });
      } catch {
        // don't block sharing if tracking fails
      }
    },
    [getHeaders]
  );

  const shareToTwitter = (entityName: string, entityId: string) => {
    const url = `${window.location.origin}/knowledge/entity/${entityId}`;
    const text = `Check out "${entityName}" on HeritageGraph`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
    trackShare(entityId, "twitter");
  };

  const shareToFacebook = (entityId: string) => {
    const url = `${window.location.origin}/knowledge/entity/${entityId}`;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank"
    );
    trackShare(entityId, "facebook");
  };

  const shareToLinkedIn = (entityId: string) => {
    const url = `${window.location.origin}/knowledge/entity/${entityId}`;
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank"
    );
    trackShare(entityId, "linkedin");
  };

  const shareViaEmail = (entityName: string, entityId: string) => {
    const url = `${window.location.origin}/knowledge/entity/${entityId}`;
    const subject = `HeritageGraph: ${entityName}`;
    const body = `Check out "${entityName}" on HeritageGraph:\n${url}`;
    window.open(
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    );
    trackShare(entityId, "email");
  };

  const copyLink = async (entityId: string) => {
    const url = `${window.location.origin}/knowledge/entity/${entityId}`;
    await navigator.clipboard.writeText(url);
    trackShare(entityId, "copy_link");
  };

  return {
    trackShare,
    shareToTwitter,
    shareToFacebook,
    shareToLinkedIn,
    shareViaEmail,
    copyLink,
  };
}
