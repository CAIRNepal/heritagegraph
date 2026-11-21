"use client";

import { Separator } from "@/components/ui/separator";
import { ReactionButtons } from "@/components/reaction-buttons";
import { ShareButton } from "@/components/share-button";
import { ForkButton } from "@/components/fork-button";
import { cn } from "@/lib/utils";

interface ContributionToolbarProps {
  entityId: string;
  entityName: string;
  className?: string;
  showReactions?: boolean;
  showShare?: boolean;
  showFork?: boolean;
}

export function ContributionToolbar({
  entityId,
  entityName,
  className,
  showReactions = true,
  showShare = true,
  showFork = true,
}: ContributionToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap",
        className
      )}
    >
      {showReactions && <ReactionButtons entityId={entityId} />}

      {showReactions && (showShare || showFork) && (
        <Separator orientation="vertical" className="h-6" />
      )}

      {showFork && (
        <ForkButton entityId={entityId} entityName={entityName} />
      )}

      {showShare && (
        <ShareButton entityId={entityId} entityName={entityName} />
      )}
    </div>
  );
}
