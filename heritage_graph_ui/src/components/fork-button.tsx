"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  GitFork,
  Loader2,
  ExternalLink,
  Clock,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useForks, type ForkInfo } from "@/hooks/use-contributions";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const FORK_REASON_OPTIONS = [
  { value: "correction", label: "Factual correction" },
  { value: "translation", label: "Language / translation variant" },
  { value: "expansion", label: "Add missing information" },
  { value: "source_addition", label: "Source citation" },
  { value: "dispute", label: "Dispute existing claim" },
  { value: "other", label: "Other" },
] as const;

export const FORK_STATUS_COLORS: Record<string, string> = {
  active: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  merged: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  promoted: "bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export const FORK_REASON_COLORS: Record<string, string> = {
  correction: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  translation: "bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary",
  expansion: "bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary",
  source_addition: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  dispute: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

// ─── Fork Button ────────────────────────────────────────────────────

interface ForkButtonProps {
  entityId: string;
  entityName: string;
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default";
}

export function ForkButton({
  entityId,
  entityName,
  className,
  variant = "outline",
  size = "sm",
}: ForkButtonProps) {
  const { data: session } = useSession();
  const { forkEntity } = useForks();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [forkReasonTag, setForkReasonTag] = useState("other");
  const [loading, setLoading] = useState(false);

  const handleFork = async () => {
    setLoading(true);
    try {
      await forkEntity(entityId, reason, forkReasonTag);
      toast.success("Entity forked successfully!", {
        description: "A new fork has been created. You can now edit it independently.",
      });
      setOpen(false);
      setReason("");
      setForkReasonTag("other");
    } catch (err: any) {
      toast.error("Failed to fork entity", {
        description: err.message || "Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("gap-1.5", className)}
          disabled={!session}
        >
          <GitFork className="h-3.5 w-3.5" />
          Fork
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitFork className="h-5 w-5" />
            Fork &ldquo;{entityName}&rdquo;
          </DialogTitle>
          <DialogDescription>
            Create an independent copy of this contribution that you can edit
            and improve. The original will be linked for provenance tracking.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Fork reason (required)</Label>
            <RadioGroup
              value={forkReasonTag}
              onValueChange={setForkReasonTag}
              className="grid grid-cols-1 gap-2"
            >
              {FORK_REASON_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`fork-reason-${opt.value}`} />
                  <Label htmlFor={`fork-reason-${opt.value}`} className="text-sm font-normal cursor-pointer">
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Brief description (optional)</Label>
            <Textarea
              placeholder="Why are you forking this?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleFork} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <GitFork className="mr-1.5 h-4 w-4" />
            )}
            Create Fork
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Fork List ──────────────────────────────────────────────────────

interface ForkListProps {
  entityId: string;
  className?: string;
}

export function ForkList({ entityId, className }: ForkListProps) {
  const { listForks } = useForks();
  const [forks, setForks] = useState<ForkInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadForks = async () => {
    setLoading(true);
    try {
      const data = await listForks(entityId);
      setForks(data);
      setLoaded(true);
    } catch {
      toast.error("Failed to load forks");
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={loadForks}
        disabled={loading}
        className={cn("gap-1.5 text-xs text-muted-foreground", className)}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <GitFork className="h-3 w-3" />
        )}
        Show Forks
      </Button>
    );
  }

  if (forks.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No forks yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <GitFork className="h-4 w-4" />
        <h4 className="text-sm font-medium">
          Forks ({forks.length})
        </h4>
      </div>
      <div className="space-y-2">
        {forks.map((fork) => (
          <a
            key={fork.id}
            href={`/knowledge/entity/view/${fork.forked_entity_id}`}
            className="flex items-start gap-3 rounded-md border p-3 text-sm hover:bg-muted/50 transition-colors"
          >
            <GitFork className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">
                  {fork.forked_entity_name || "Forked contribution"}
                </span>
                <Badge className={cn("text-[10px] shrink-0 border-0", FORK_STATUS_COLORS[fork.fork_status] || FORK_STATUS_COLORS.active)}>
                  {fork.fork_status_display || fork.fork_status || "Active"}
                </Badge>
                {fork.fork_reason_tag && fork.fork_reason_tag !== "other" && (
                  <Badge className={cn("text-[10px] shrink-0 border-0", FORK_REASON_COLORS[fork.fork_reason_tag] || FORK_REASON_COLORS.other)}>
                    {fork.fork_reason_tag_display || fork.fork_reason_tag}
                  </Badge>
                )}
              </div>
              {fork.reason && (
                <p className="text-xs text-muted-foreground">{fork.reason}</p>
              )}
              {fork.diff_field_count > 0 && (
                <p className="text-xs text-muted-foreground">
                  {fork.diff_field_count} field{fork.diff_field_count !== 1 ? "s" : ""} changed
                  {fork.diff_summary && Object.keys(fork.diff_summary).length > 0 && (
                    <span className="ml-1">
                      ({Object.keys(fork.diff_summary).slice(0, 3).join(", ")}
                      {Object.keys(fork.diff_summary).length > 3 ? ", ..." : ""})
                    </span>
                  )}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {fork.forked_by?.username || "Unknown"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {fork.created_at
                    ? formatDistanceToNow(new Date(fork.created_at), {
                        addSuffix: true,
                      })
                    : ""}
                </span>
              </div>
            </div>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-1 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}
