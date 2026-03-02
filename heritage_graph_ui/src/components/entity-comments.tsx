"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  MessageSquare,
  Reply,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useComments,
  type Comment as CommentType,
} from "@/hooks/use-contributions";
import { ReactionButtons } from "@/components/reaction-buttons";
import { formatDistanceToNow } from "date-fns";

interface EntityCommentsProps {
  entityId: string;
  className?: string;
}

export function EntityComments({ entityId, className }: EntityCommentsProps) {
  const { data: session } = useSession();
  const { comments, loading, fetchComments, addComment, deleteComment } =
    useComments(entityId);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await addComment(newComment.trim());
      setNewComment("");
    } catch {
      // error
    } finally {
      setSubmitting(false);
    }
  };

  const totalComments = comments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length || 0),
    0
  );

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="text-lg font-semibold">Comments</h3>
        {totalComments > 0 && (
          <Badge variant="secondary" className="text-xs">
            {totalComments}
          </Badge>
        )}
      </div>

      {/* New Comment Form */}
      {session ? (
        <div className="space-y-3">
          <Textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Press Ctrl+Enter to submit
            </p>
            <Button
              size="sm"
              disabled={!newComment.trim() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Comment
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign in to leave a comment.
        </p>
      )}

      <Separator />

      {/* Comments List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No comments yet. Be the first to comment!
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              entityId={entityId}
              onReply={(text: string, parentId: number) =>
                addComment(text, parentId)
              }
              onDelete={deleteComment}
              currentUsername={
                (session?.user as any)?.username || session?.user?.name
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single Comment ────────────────────────────────────────────────────

interface CommentItemProps {
  comment: CommentType;
  entityId: string;
  onReply: (text: string, parentId: number) => Promise<any>;
  onDelete: (commentPk: number) => Promise<void>;
  currentUsername?: string | null;
  depth?: number;
}

function CommentItem({
  comment,
  entityId,
  onReply,
  onDelete,
  currentUsername,
  depth = 0,
}: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const isOwn = currentUsername && comment.user?.username === currentUsername;
  const initials = comment.user
    ? `${comment.user.first_name?.[0] || ""}${comment.user.last_name?.[0] || ""}`.toUpperCase() ||
      comment.user.username[0]?.toUpperCase()
    : "?";

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(replyText.trim(), comment.id);
      setReplyText("");
      setShowReplyForm(false);
    } catch {
      // error
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(comment.id);
    } catch {
      setDeleting(false);
    }
  };

  const timeAgo = comment.created_at
    ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })
    : "";

  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className={cn("group", depth > 0 && "ml-8 border-l-2 pl-4")}>
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">
              {comment.user?.first_name && comment.user?.last_name
                ? `${comment.user.first_name} ${comment.user.last_name}`
                : comment.user?.username || "Unknown"}
            </span>
            {isOwn && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                You
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>

          <p className="mt-1 text-sm whitespace-pre-wrap break-words">
            {comment.comment}
          </p>

          {/* Actions Row */}
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <ReactionButtons
              commentId={comment.comment_id || String(comment.id)}
              size="sm"
            />

            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <Reply className="h-3 w-3" />
              Reply
            </Button>

            {isOwn && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-red-600"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Delete
              </Button>
            )}

            {hasReplies && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => setShowReplies(!showReplies)}
              >
                {showReplies ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {comment.replies.length}{" "}
                {comment.replies.length === 1 ? "reply" : "replies"}
              </Button>
            )}
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder={`Reply to ${comment.user?.username || "this comment"}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[60px] resize-none text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    handleReply();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyText("");
                  }}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!replyText.trim() || submitting}
                  onClick={handleReply}
                  className="h-7 text-xs"
                >
                  {submitting ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  Reply
                </Button>
              </div>
            </div>
          )}

          {/* Nested Replies */}
          {hasReplies && showReplies && (
            <div className="mt-4 space-y-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  entityId={entityId}
                  onReply={onReply}
                  onDelete={onDelete}
                  currentUsername={currentUsername}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
