"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReactions, type ReactionSummary } from "@/hooks/use-contributions";

interface ReactionButtonsProps {
  entityId?: string;
  commentId?: string;
  className?: string;
  size?: "sm" | "default";
}

export function ReactionButtons({
  entityId,
  commentId,
  className,
  size = "default",
}: ReactionButtonsProps) {
  const { data: session } = useSession();
  const { toggleReaction, getSummary } = useReactions();
  const [summary, setSummary] = useState<ReactionSummary>({
    upvotes: 0,
    downvotes: 0,
    user_reaction: null,
  });
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await getSummary(entityId, commentId);
      setSummary(data);
    } catch {
      // ignore
    }
  }, [entityId, commentId, getSummary]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleReaction = async (type: "upvote" | "downvote") => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await toggleReaction(type, entityId, commentId);
      // Optimistic update
      setSummary((prev) => {
        const newSummary = { ...prev };
        if (result.action === "removed") {
          if (type === "upvote") newSummary.upvotes--;
          else newSummary.downvotes--;
          newSummary.user_reaction = null;
        } else if (result.action === "switched") {
          if (type === "upvote") {
            newSummary.upvotes++;
            newSummary.downvotes--;
          } else {
            newSummary.upvotes--;
            newSummary.downvotes++;
          }
          newSummary.user_reaction = type;
        } else {
          if (type === "upvote") newSummary.upvotes++;
          else newSummary.downvotes++;
          newSummary.user_reaction = type;
        }
        return newSummary;
      });
    } catch {
      // revert on error
      await fetchSummary();
    } finally {
      setLoading(false);
    }
  };

  const isSmall = size === "sm";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="sm"
        disabled={loading || !session}
        onClick={() => handleReaction("upvote")}
        className={cn(
          "gap-1 px-2",
          isSmall && "h-7 text-xs",
          summary.user_reaction === "upvote" &&
            "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        )}
      >
        <ThumbsUp className={cn("w-3.5 h-3.5", isSmall && "w-3 h-3")} />
        {summary.upvotes > 0 && (
          <span className="text-xs">{summary.upvotes}</span>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={loading || !session}
        onClick={() => handleReaction("downvote")}
        className={cn(
          "gap-1 px-2",
          isSmall && "h-7 text-xs",
          summary.user_reaction === "downvote" &&
            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        )}
      >
        <ThumbsDown className={cn("w-3.5 h-3.5", isSmall && "w-3 h-3")} />
        {summary.downvotes > 0 && (
          <span className="text-xs">{summary.downvotes}</span>
        )}
      </Button>
    </div>
  );
}
