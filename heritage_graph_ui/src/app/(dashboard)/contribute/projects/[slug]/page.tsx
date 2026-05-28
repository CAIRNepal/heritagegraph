"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IconArrowLeft,
  IconGitFork,
  IconLoader2,
  IconUsers,
  IconFiles,
  IconGraph,
  IconActivity,
  IconMessageCircle,
  IconSend,
} from "@tabler/icons-react";
import { fadeInUp, glassCard } from "@/lib/design";
import { extractProjectSubmissionBlockers, getApiErrorMessage } from "@/lib/api-client";
import { useProjectDetail } from "@/hooks/use-project-detail";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  postProjectComment,
  PROJECT_STATE_LABELS,
  PROJECT_TRANSITION_LABELS,
  rollbackProjectMerge,
  transitionProject,
  type ProjectCommentRow,
} from "@/lib/projects-api";
import { ProjectStepStrip } from "@/components/projects/project-step-strip";
import { ProjectAssetUploader } from "@/components/projects/project-asset-uploader";
import { ProjectAssetCard } from "@/components/projects/project-asset-card";
import { ProjectMembersPanel } from "@/components/projects/project-members-panel";
import { ProjectAddPanel } from "@/components/projects/project-add-panel";
import { ProjectEntityRow } from "@/components/projects/project-entity-row";
import { ProjectReviewerPanel } from "@/components/projects/project-reviewer-panel";
import {
  appendProjectToRoute,
  projectGraphPath,
} from "@/lib/project-contribute";

const STATE_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  needs_revision: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  merged: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  withdrawn: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

const TRANSITION_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  in_review: "default",
  approved: "default",
  merged: "default",
  needs_revision: "outline",
  withdrawn: "destructive",
  draft: "outline",
};

function CommentThread({ comment, depth = 0 }: { comment: ProjectCommentRow; depth?: number }) {
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

export default function ProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const {
    project,
    setProject,
    activity,
    comments,
    setComments,
    loadStatus,
    errorMessage,
    token,
    refetch,
  } = useProjectDetail(slug);

  const { isModerator, isReviewer } = useUserRoles();

  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [transitioningTarget, setTransitioningTarget] = useState<string | null>(null);
  const [transitionError, setTransitionError] = useState("");
  const [submissionBlockers, setSubmissionBlockers] = useState<string[]>([]);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [mergeRollbackBusy, setMergeRollbackBusy] = useState(false);

  const readOnlyWorkspace =
    project?.state === "merged" || project?.state === "in_review";

  if (loadStatus === "auth_pending" || loadStatus === "loading" || loadStatus === "idle") {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">Loading project…</div>
    );
  }

  if (loadStatus === "not_found" || loadStatus === "forbidden" || loadStatus === "error") {
    return (
      <div className="max-w-lg mx-auto text-center py-20 space-y-4">
        <p className="text-muted-foreground">{errorMessage ?? "Could not load this project."}</p>
        <Button variant="outline" onClick={() => router.push("/contribute/projects")}>
          Back to projects
        </Button>
      </div>
    );
  }

  if (!project || !token) return null;

  const stateColor = STATE_COLORS[project.state] ?? STATE_COLORS.draft;
  const canEditAssets = project.can_edit && !readOnlyWorkspace;

  const handleTransition = async (targetState: string, comment?: string) => {
    const previousState = project.state;
    setTransitioningTarget(targetState);
    setTransitionError("");
    setSubmissionBlockers([]);
    setProject((prev) => (prev ? { ...prev, state: targetState } : prev));
    try {
      const updated = await transitionProject(slug, token, targetState, comment);
      setSubmissionBlockers([]);
      setProject(updated);
      await refetch();
    } catch (e) {
      setProject((prev) => (prev ? { ...prev, state: previousState } : prev));
      const blockers = extractProjectSubmissionBlockers(e);
      if (blockers?.length) setSubmissionBlockers(blockers);
      else setSubmissionBlockers([]);
      setTransitionError(blockers?.length ? "" : getApiErrorMessage(e));
    } finally {
      setTransitioningTarget(null);
    }
  };

  const handleRollbackMerge = async () => {
    if (
      !confirm(
        "Return this merged project to “needs revision”? Coordinate RDF / graph cleanup separately."
      )
    )
      return;
    setMergeRollbackBusy(true);
    try {
      const updated = await rollbackProjectMerge(slug, token);
      setProject(updated);
      toast.success("Merge rolled back.");
      await refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not roll back merge."));
    } finally {
      setMergeRollbackBusy(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      await postProjectComment(slug, token, commentText.trim());
      setCommentText("");
      const { listProjectComments } = await import("@/lib/projects-api");
      setComments(await listProjectComments(slug, token));
      await refetch();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not post comment."));
    } finally {
      setPostingComment(false);
    }
  };

  const showReviewerPanel =
    (isReviewer || isModerator) &&
    (project.state === "in_review" || project.state === "needs_revision");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <motion.div initial="hidden" animate="show" variants={fadeInUp} className="space-y-4">
        <button
          type="button"
          onClick={() => router.push("/contribute/projects")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconArrowLeft className="w-4 h-4" /> All Projects
        </button>

        <div className={`${glassCard} p-5 space-y-4`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-blue-900 dark:text-blue-100">{project.title}</h1>
                <Badge className={`${stateColor} text-xs px-2`}>
                  {PROJECT_STATE_LABELS[project.state] ?? project.state}
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
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              <Button size="sm" variant="outline" asChild>
                <a
                  href={projectGraphPath(slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open graph
                </a>
              </Button>
            {(project.allowed_transitions.length > 0 ||
              (isModerator && project.state === "merged")) && (
              <>
                {project.allowed_transitions.map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={TRANSITION_VARIANT[t] ?? "outline"}
                    disabled={transitioningTarget !== null || mergeRollbackBusy}
                    onClick={() => {
                      if (t === "needs_revision") {
                        setRevisionNote("");
                        setRevisionDialogOpen(true);
                        return;
                      }
                      void handleTransition(t);
                    }}
                  >
                    {transitioningTarget === t ? (
                      <>
                        <IconLoader2 className="w-3.5 h-3.5 mr-1 animate-spin" aria-hidden />{" "}
                        Working…
                      </>
                    ) : (
                      (PROJECT_TRANSITION_LABELS[t] ?? t)
                    )}
                  </Button>
                ))}
                {isModerator && project.state === "merged" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={mergeRollbackBusy || transitioningTarget !== null}
                    onClick={() => void handleRollbackMerge()}
                  >
                    {mergeRollbackBusy ? "Rolling back…" : "Undo merge"}
                  </Button>
                )}
              </>
            )}
            </div>
          </div>

          <ProjectStepStrip project={project} submissionBlockers={submissionBlockers} />

          {transitionError && (
            <p className="text-sm text-red-600 dark:text-red-400 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              {transitionError}
            </p>
          )}
        </div>

        <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request revision</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Explain what the contributor must change before this project can be approved.
            </p>
            <Textarea
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              placeholder="Revision notes…"
              rows={4}
              aria-required
              className="min-h-[100px]"
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setRevisionDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!revisionNote.trim() || transitioningTarget !== null}
                onClick={() => {
                  const note = revisionNote.trim();
                  if (!note) return;
                  setRevisionDialogOpen(false);
                  void handleTransition("needs_revision", note);
                }}
              >
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      <div
        className={
          showReviewerPanel ? "grid gap-6 lg:grid-cols-[1fr_280px] items-start" : undefined
        }
      >
        <div className="min-w-0">
      <Tabs defaultValue="entities">
        <TabsList className="flex-wrap h-auto gap-1 p-1 bg-blue-50/80 dark:bg-gray-800/80">
          <TabsTrigger value="entities" className="text-xs gap-1.5">
            <IconGraph className="w-3.5 h-3.5" /> Entities ({project.entities.length})
          </TabsTrigger>
          <TabsTrigger value="assets" className="text-xs gap-1.5">
            <IconFiles className="w-3.5 h-3.5" /> Assets ({project.assets.length})
          </TabsTrigger>
          <TabsTrigger value="members" className="text-xs gap-1.5">
            <IconUsers className="w-3.5 h-3.5" /> Members ({project.memberships.length + 1})
          </TabsTrigger>
          <TabsTrigger value="comments" className="text-xs gap-1.5">
            <IconMessageCircle className="w-3.5 h-3.5" /> Discussion ({comments.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs gap-1.5">
            <IconActivity className="w-3.5 h-3.5" /> Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="mt-4 space-y-4">
          {canEditAssets && (
            <ProjectAddPanel
              projectSlug={slug}
              intendedSubject={project.intended_subject}
            />
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Records linked to this dossier.</p>
            {canEditAssets && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  router.push(appendProjectToRoute("/contribute/entity", slug))
                }
              >
                Add entity
              </Button>
            )}
          </div>
          {project.entities.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No entities linked yet.</p>
          ) : (
            <div className="space-y-2">
              {project.entities.map((e) => (
                <ProjectEntityRow
                  key={e.id}
                  slug={slug}
                  row={e}
                  accessToken={token}
                  canEdit={canEditAssets}
                  onUnlinked={() => void refetch()}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assets" className="mt-4 space-y-4">
          {canEditAssets && (
            <ProjectAssetUploader
              slug={slug}
              accessToken={token}
              onUploaded={(_asset) => void refetch()}
            />
          )}
          {project.assets.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No assets uploaded yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {project.assets.map((a) => (
                <ProjectAssetCard
                  key={a.id}
                  slug={slug}
                  accessToken={token}
                  asset={a}
                  canEdit={canEditAssets}
                  onChange={() => void refetch()}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <ProjectMembersPanel
            project={project}
            accessToken={token}
            canEdit={project.can_edit && project.state !== "merged"}
            onChange={() => void refetch()}
          />
        </TabsContent>

        <TabsContent value="comments" className="mt-4 space-y-4">
          {comments.map((c) => (
            <CommentThread key={c.comment_id} comment={c} />
          ))}
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
              onClick={() => void handlePostComment()}
              className="gap-1.5"
            >
              <IconSend className="w-3.5 h-3.5" />
              {postingComment ? "Posting…" : "Post Comment"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-2">
          {activity.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No activity yet.</p>
          ) : (
            activity.map((a) => (
              <div key={a.id} className={`${glassCard} p-3 flex items-start gap-3 text-sm`}>
                <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{a.actor?.username ?? "system"}</span>
                  <span className="text-muted-foreground ml-1">{a.action.replace(/_/g, " ")}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(a.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
        </div>
        {showReviewerPanel && (
          <ProjectReviewerPanel project={project} activity={activity} />
        )}
      </div>
    </div>
  );
}
