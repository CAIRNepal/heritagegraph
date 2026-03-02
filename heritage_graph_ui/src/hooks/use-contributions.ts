"use client";

import { useSession } from "next-auth/react";
import { useCallback, useState } from "react";

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
  original_entity_name: string;
  forked_by: { id: number; username: string };
  reason: string;
  created_at: string;
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
      const res = await fetch(
        `${API_BASE_URL}/data/api/reactions/toggle/`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            reaction_type: reactionType,
            ...(entityId ? { entity_id: entityId } : {}),
            ...(commentId ? { comment_id: commentId } : {}),
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to toggle reaction");
      return res.json();
    },
    [getHeaders]
  );

  const getSummary = useCallback(
    async (entityId?: string, commentId?: string): Promise<ReactionSummary> => {
      const params = entityId
        ? `entity_id=${entityId}`
        : `comment_id=${commentId}`;
      const res = await fetch(
        `${API_BASE_URL}/data/api/reactions/summary/?${params}`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error("Failed to get reaction summary");
      return res.json();
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
      const res = await fetch(
        `${API_BASE_URL}/data/api/entities/${entityId}/comments/`,
        { headers: getHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setComments(data.results || data);
      }
    } finally {
      setLoading(false);
    }
  }, [entityId, getHeaders]);

  const addComment = useCallback(
    async (text: string, parentId?: number) => {
      const res = await fetch(
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
      if (!res.ok) throw new Error("Failed to add comment");
      const newComment = await res.json();
      await fetchComments(); // refresh
      return newComment;
    },
    [entityId, getHeaders, fetchComments]
  );

  const deleteComment = useCallback(
    async (commentPk: number) => {
      const res = await fetch(
        `${API_BASE_URL}/data/api/entities/${entityId}/comments/${commentPk}/`,
        { method: "DELETE", headers: getHeaders() }
      );
      if (!res.ok) throw new Error("Failed to delete comment");
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
    async (entityId: string, reason: string = "", changes: Record<string, any> = {}) => {
      const res = await fetch(`${API_BASE_URL}/data/api/forks/`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ entity_id: entityId, reason, changes }),
      });
      if (!res.ok) throw new Error("Failed to fork entity");
      return res.json();
    },
    [getHeaders]
  );

  const listForks = useCallback(
    async (entityId: string): Promise<ForkInfo[]> => {
      const res = await fetch(
        `${API_BASE_URL}/data/api/forks/?entity_id=${entityId}`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error("Failed to list forks");
      return res.json();
    },
    [getHeaders]
  );

  return { forkEntity, listForks };
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
      const res = await fetch(
        `${API_BASE_URL}/data/api/entities/${entityId}/diff/?from=${fromRev}&to=${toRev}`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error("Failed to get diff");
      return res.json();
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
    const url = `${window.location.origin}/dashboard/knowledge/entity/${entityId}`;
    const text = `Check out "${entityName}" on HeritageGraph`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      "_blank"
    );
    trackShare(entityId, "twitter");
  };

  const shareToFacebook = (entityId: string) => {
    const url = `${window.location.origin}/dashboard/knowledge/entity/${entityId}`;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank"
    );
    trackShare(entityId, "facebook");
  };

  const shareToLinkedIn = (entityId: string) => {
    const url = `${window.location.origin}/dashboard/knowledge/entity/${entityId}`;
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank"
    );
    trackShare(entityId, "linkedin");
  };

  const shareViaEmail = (entityName: string, entityId: string) => {
    const url = `${window.location.origin}/dashboard/knowledge/entity/${entityId}`;
    const subject = `HeritageGraph: ${entityName}`;
    const body = `Check out "${entityName}" on HeritageGraph:\n${url}`;
    window.open(
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    );
    trackShare(entityId, "email");
  };

  const copyLink = async (entityId: string) => {
    const url = `${window.location.origin}/dashboard/knowledge/entity/${entityId}`;
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
