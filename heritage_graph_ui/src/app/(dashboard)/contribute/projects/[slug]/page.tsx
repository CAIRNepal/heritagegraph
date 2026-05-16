"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IconArrowLeft,
  IconGitFork,
  IconUsers,
  IconFiles,
  IconGraph,
  IconActivity,
  IconMessageCircle,
  IconSend,
} from "@tabler/icons-react";
import { fadeInUp, glassCard } from "@/lib/design";
import { getPublicApiUrl } from "@/lib/api-base";

/* ── Types ── */
interface ProjectDetail {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  intended_subject: string;
  state: string;
  visibility: string;
  owner: { id: string; username: string; email: string };
  forked_from: string | null;
  schema_version: string;
  tags: string[];
  memberships: MemberRow[];
  assets: AssetRow[];
  entities: EntityRow[];
  submitted_at: string | null;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  id: string;
  user: { id: string; username: string; email: string };
  role: string;
  created_at: string;
}

interface AssetRow {
  id: string;
  media: string;
  media_url: string | null;
  media_type: string;
  role: string;
  caption: string;
  uploaded_by: { id: string; username: string; email: string };
}

interface EntityRow {
  id: string;
  entity: string;
  entity_name: string;
  entity_category: string;
  entity_status: string;
  role_in_project: string;
  added_by: { id: string; username: string; email: string };
  added_at: string;
}

interface ActivityRow {
  id: string;
  actor: { id: string; username: string; email: string } | null;
  action: string;
  target_kind: string;
  target_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface CommentRow {
  comment_id: string;
  user: { id: string; username: string; email: string };
  comment: string;
  parent: string | null;
  replies: CommentRow[];
  created_at: string;
}

/* ── Constants ── */
const STATE_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  needs_revision: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  merged: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  withdrawn: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

const STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  needs_revision: "Needs Revision",
  approved: "Approved",
  merged: "Merged",
  withdrawn: "Withdrawn",
};

const NEXT_STATES: Record<string, { state: string; label: string; variant: "default" | "outline" | "destructive" }[]> = {
  draft: [
    { state: "in_review", label: "Submit for Review", variant: "default" },
    { state: "withdrawn", label: "Withdraw", variant: "destructive" },
  ],
  in_review: [
    { state: "approved", label: "Approve", variant: "default" },
    { state: "needs_revision", label: "Request Revision", variant: "outline" },
    { state: "withdrawn", label: "Withdraw", variant: "destructive" },
  ],
  needs_revision: [
    { state: "in_review", label: "Resubmit", variant: "default" },
    { state: "withdrawn", label: "Withdraw", variant: "destructive" },
  ],
  approved: [
    { state: "merged", label: "Merge", variant: "default" },
    { state: "withdrawn", label: "Withdraw", variant: "destructive" },
  ],
  merged: [],
  withdrawn: [{ state: "draft", label: "Reopen as Draft", variant: "outline" }],
};

/* ── Sub-components ── */
function CommentThread({
  comment,
  depth = 0,
}: {
  comment: CommentRow;
  depth?: number;
}) {
  return (
    <div className={depth > 0 ? "ml-6 border-l border-blue-100 dark:border-blue-900 pl-4" : ""}>
      <div className={`${glassCard} p-3 mb-2`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">{comment.user.username}</span>
          <span className="text-[10px] text-muted-foreground">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.comment}</p>
      </div>
      {comment.replies.map((r) => (
        <CommentThread key={r.comment_id} comment={r} depth={depth + 1} />
      ))}
    </div>
  );
}

/* ── Main Page ── */
export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState("");

  const base = getPublicApiUrl();

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${session?.accessToken ?? ""}`,
      "Content-Type": "application/json",
    }),
    [session]
  );

  const fetchProject = useCallback(async () => {
    if (!session?.accessToken) return;
    const res = await fetch(`${base}/api/v1/data/projects/${slug}/`, {
      headers: authHeaders(),
    });
    if (res.ok) setProject(await res.json());
  }, [base, slug, session, authHeaders]);

  const fetchActivity = useCallback(async () => {
    if (!session?.accessToken) return;
    const res = await fetch(`${base}/api/v1/data/projects/${slug}/activity/`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      setActivity(Array.isArray(data) ? data : (data.results ?? []));
    }
  }, [base, slug, session, authHeaders]);

  const fetchComments = useCallback(async () => {
    if (!session?.accessToken) return;
    const res = await fetch(`${base}/api/v1/data/projects/${slug}/comments/`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      setComments(Array.isArray(data) ? data : (data.results ?? []));
    }
  }, [base, slug, session, authHeaders]);

  useEffect(() => {
    fetchProject();
    fetchActivity();
    fetchComments();
  }, [fetchProject, fetchActivity, fetchComments]);

  const handleTransition = async (targetState: string) => {
    if (!session?.accessToken || !project) return;
    setTransitioning(true);
    setError("");
    try {
      const res = await fetch(`${base}/api/v1/data/projects/${slug}/transition/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ target_state: targetState }),
      });
      if (res.ok) {
        await fetchProject();
        await fetchActivity();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.detail ?? d.non_field_errors?.[0] ?? "Transition failed.");
      }
    } finally {
      setTransitioning(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !session?.accessToken) return;
    setPostingComment(true);
    try {
      const res = await fetch(`${base}/api/v1/data/projects/${slug}/comments/`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ comment: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText("");
        await fetchComments();
        await fetchActivity();
      }
    } finally {
      setPostingComment(false);
    }
  };

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">Loading project…</div>
    );
  }

  const stateColor = STATE_COLORS[project.state] ?? STATE_COLORS.draft;
  const transitions = NEXT_STATES[project.state] ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial="hidden" animate="show" variants={fadeInUp} className="space-y-4">
        <button
          type="button"
          onClick={() => router.push("/contribute/projects")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconArrowLeft className="w-4 h-4" /> All Projects
        </button>

        <div className={`${glassCard} p-5`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                  {project.title}
                </h1>
                <Badge className={`${stateColor} text-xs px-2`}>
                  {STATE_LABELS[project.state] ?? project.state}
                </Badge>
                {project.forked_from && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <IconGitFork className="w-3 h-3" /> fork
                  </Badge>
                )}
              </div>
              {project.abstract && (
                <p className="text-sm text-muted-foreground">{project.abstract}</p>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                <span>Owner: {project.owner.username}</span>
                <span>{project.entities.length} entities</span>
                <span>{project.assets.length} assets</span>
                {project.intended_subject && <span>Subject: {project.intended_subject}</span>}
              </div>
              {project.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {transitions.length > 0 && (
              <div className="flex flex-wrap gap-2 shrink-0">
                {transitions.map((t) => (
                  <Button
                    key={t.state}
                    size="sm"
                    variant={t.variant}
                    disabled={transitioning}
                    onClick={() => handleTransition(t.state)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-3 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </p>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div initial="hidden" animate="show" variants={fadeInUp}>
        <Tabs defaultValue="entities">
          <TabsList className="flex-wrap h-auto gap-1 p-1 bg-blue-50/80 dark:bg-gray-800/80">
            <TabsTrigger value="entities" className="text-xs gap-1.5">
              <IconGraph className="w-3.5 h-3.5" /> Entities ({project.entities.length})
            </TabsTrigger>
            <TabsTrigger value="assets" className="text-xs gap-1.5">
              <IconFiles className="w-3.5 h-3.5" /> Assets ({project.assets.length})
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs gap-1.5">
              <IconUsers className="w-3.5 h-3.5" /> Members ({project.memberships.length})
            </TabsTrigger>
            <TabsTrigger value="comments" className="text-xs gap-1.5">
              <IconMessageCircle className="w-3.5 h-3.5" /> Discussion ({comments.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5">
              <IconActivity className="w-3.5 h-3.5" /> Activity
            </TabsTrigger>
          </TabsList>

          {/* Entities */}
          <TabsContent value="entities" className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Ontology entities authored inside this project.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push("/contribute")}
              >
                Add Entity
              </Button>
            </div>
            {project.entities.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No entities yet. Use the Contribute hub to create entities, then link them here.
              </div>
            ) : (
              <div className="space-y-2">
                {project.entities.map((e) => (
                  <div key={e.id} className={`${glassCard} p-3 flex items-center justify-between`}>
                    <div>
                      <span className="font-medium text-sm">{e.entity_name || e.entity}</span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {e.entity_category} · {e.entity_status}
                        {e.role_in_project && ` · ${e.role_in_project}`}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">{e.entity_status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Assets */}
          <TabsContent value="assets" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Uploaded evidence: images, documents, audio.
            </p>
            {project.assets.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No assets uploaded yet.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {project.assets.map((a) => (
                  <div key={a.id} className={`${glassCard} p-3`}>
                    <div className="flex items-start gap-2">
                      <div className="w-10 h-10 rounded bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-lg shrink-0">
                        {a.media_type?.startsWith("image") ? "🖼" : a.media_type?.startsWith("audio") ? "🎵" : "📄"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.caption || a.media}</p>
                        <p className="text-xs text-muted-foreground">{a.role} · {a.media_type}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Members */}
          <TabsContent value="members" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Collaborators on this project.
            </p>
            <div className="space-y-2">
              {/* Owner */}
              <div className={`${glassCard} p-3 flex items-center justify-between`}>
                <div>
                  <span className="font-medium text-sm">{project.owner.username}</span>
                  <span className="text-xs text-muted-foreground ml-2">{project.owner.email}</span>
                </div>
                <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">owner</Badge>
              </div>
              {project.memberships.map((m) => (
                <div key={m.id} className={`${glassCard} p-3 flex items-center justify-between`}>
                  <div>
                    <span className="font-medium text-sm">{m.user.username}</span>
                    <span className="text-xs text-muted-foreground ml-2">{m.user.email}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{m.role}</Badge>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Discussion */}
          <TabsContent value="comments" className="mt-4 space-y-4">
            <div className="space-y-3">
              {comments.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  No discussion yet. Start the conversation.
                </p>
              )}
              {comments.map((c) => (
                <CommentThread key={c.comment_id} comment={c} />
              ))}
            </div>

            <div className={`${glassCard} p-4 space-y-3`}>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
              />
              <Button
                size="sm"
                disabled={!commentText.trim() || postingComment}
                onClick={handlePostComment}
                className="gap-1.5"
              >
                <IconSend className="w-3.5 h-3.5" />
                {postingComment ? "Posting…" : "Post Comment"}
              </Button>
            </div>
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity" className="mt-4 space-y-2">
            {activity.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No activity yet.</p>
            ) : (
              activity.map((a) => (
                <div
                  key={a.id}
                  className={`${glassCard} p-3 flex items-start gap-3 text-sm`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-600 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{a.actor?.username ?? "system"}</span>
                    <span className="text-muted-foreground ml-1">{a.action.replace(/_/g, " ")}</span>
                    {a.target_kind && (
                      <span className="text-muted-foreground"> · {a.target_kind}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(a.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
