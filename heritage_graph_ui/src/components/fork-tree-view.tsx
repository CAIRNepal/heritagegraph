"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitFork,
  Loader2,
  ChevronRight,
  User,
  Clock,
  ExternalLink,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useForks, type ForkLineageNode } from "@/hooks/use-contributions";
import { FORK_STATUS_COLORS, FORK_REASON_COLORS } from "@/components/fork-button";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

function TreeNode({
  node,
  depth = 0,
}: {
  node: ForkLineageNode;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const statusColor = node.fork_info
    ? FORK_STATUS_COLORS[node.fork_info.fork_status] || FORK_STATUS_COLORS.active
    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";

  return (
    <div>
      <a
        href={`/knowledge/entity/view/${node.entity_id}`}
        className="flex items-start gap-2 p-2 rounded-md text-sm hover:bg-muted/50 transition-colors group"
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <ChevronRight
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-90"
              )}
            />
          </Button>
        ) : (
          <div className="w-5 h-5 shrink-0 flex items-center justify-center">
            <GitFork className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{node.name}</span>
            <Badge
              className={cn("text-[10px] border-0", statusColor)}
            >
              {node.fork_info ? node.fork_info.fork_status : node.status}
            </Badge>
            {node.fork_info &&
              node.fork_info.fork_reason_tag !== "other" && (
                <Badge
                  className={cn(
                    "text-[10px] border-0",
                    FORK_REASON_COLORS[node.fork_info.fork_reason_tag] || ""
                  )}
                >
                  {node.fork_info.fork_reason_tag.replace("_", " ")}
                </Badge>
              )}
          </div>
          {node.fork_info?.diff_field_count ? (
            <p className="text-xs text-muted-foreground">
              {node.fork_info.diff_field_count} field(s) changed
              {node.fork_info.diff_fields.length > 0 && (
                <span className="ml-1">
                  ({node.fork_info.diff_fields.slice(0, 3).join(", ")}
                  {node.fork_info.diff_fields.length > 3 ? ", ..." : ""})
                </span>
              )}
            </p>
          ) : null}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {node.fork_info?.forked_by || node.contributor_username}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(node.created_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
      {hasChildren && expanded && (
        <div className="ml-6 pl-3 border-l border-border space-y-0.5 mt-0.5">
          {node.children.map((child) => (
            <TreeNode
              key={child.entity_id}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ForkTreeViewProps {
  entityId: string;
  className?: string;
}

export function ForkTreeView({ entityId, className }: ForkTreeViewProps) {
  const { getLineage } = useForks();
  const [lineage, setLineage] = useState<ForkLineageNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLineage(entityId);
      setLineage(data);
      setLoaded(true);
    } catch {
      toast.error("Failed to load fork tree");
    } finally {
      setLoading(false);
    }
  }, [entityId, getLineage]);

  if (!loaded) {
    return (
      <div className={cn("space-y-3", className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={loadTree}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <GitFork className="h-3.5 w-3.5" />
          )}
          Load Fork Tree
        </Button>
      </div>
    );
  }

  if (!lineage) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Failed to load fork tree.
      </p>
    );
  }

  const totalNodes = countNodes(lineage);
  const hasForks = totalNodes > 1;

  if (!hasForks) {
    return (
      <div className={cn("space-y-2", className)}>
        <p className="text-sm text-muted-foreground">
          No forks yet. Be the first to fork this contribution.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => window.location.href = `/curation/forks?entity=${entityId}`}
        >
          <ArrowLeftRight className="h-3 w-3" /> Open in Fork Viewer
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitFork className="h-4 w-4" />
          <h4 className="text-sm font-medium">
            Fork Tree ({totalNodes} nodes)
          </h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => window.location.href = `/curation/forks?entity=${entityId}`}
        >
          <ArrowLeftRight className="h-3 w-3" /> Open in Fork Viewer
        </Button>
      </div>
      <ScrollArea className="max-h-[400px]">
        <TreeNode node={lineage} />
      </ScrollArea>
    </div>
  );
}

function countNodes(node: ForkLineageNode): number {
  let count = 1;
  if (node.children) {
    for (const child of node.children) count += countNodes(child);
  }
  return count;
}
