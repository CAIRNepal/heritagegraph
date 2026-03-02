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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useForks, type ForkInfo } from "@/hooks/use-contributions";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(false);

  const handleFork = async () => {
    setLoading(true);
    try {
      const result = await forkEntity(entityId, reason);
      toast.success("Entity forked successfully!", {
        description: `A new fork has been created. You can now edit it independently.`,
      });
      setOpen(false);
      setReason("");
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
      <DialogContent>
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
        <div className="space-y-3 py-2">
          <Textarea
            placeholder="Why are you forking this? (optional — e.g., adding missing details, correcting information)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[80px] resize-none"
          />
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
          <div
            key={fork.id}
            className="flex items-start gap-3 rounded-md border p-3 text-sm"
          >
            <GitFork className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">
                  {fork.forked_entity_name || "Forked contribution"}
                </span>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  Fork
                </Badge>
              </div>
              {fork.reason && (
                <p className="text-xs text-muted-foreground">{fork.reason}</p>
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
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
