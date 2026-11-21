"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { IconExternalLink, IconUnlink } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { glassCard } from "@/lib/design";
import { getApiErrorMessage } from "@/lib/api-client";
import { culturalEntityKnowledgePath } from "@/lib/project-contribute";
import {
  unlinkProjectEntity,
  type ProjectEntityRow as ProjectEntityRowType,
} from "@/lib/projects-api";
import { ProjectPlatformMatchBadge } from "@/components/projects/project-platform-match-badge";

export function ProjectEntityRow({
  slug,
  row,
  accessToken,
  canEdit,
  onUnlinked,
}: {
  slug: string;
  row: ProjectEntityRowType;
  accessToken: string;
  canEdit: boolean;
  onUnlinked: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleUnlink = async () => {
    setBusy(true);
    try {
      await unlinkProjectEntity(slug, row.id, accessToken);
      toast.success("Entity removed from project.");
      setConfirmOpen(false);
      onUnlinked();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not unlink entity."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={`${glassCard} p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={culturalEntityKnowledgePath(row.entity)}
              className="font-medium text-sm hover:underline inline-flex items-center gap-1"
            >
              {row.entity_name || row.entity}
              <IconExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>
            <ProjectPlatformMatchBadge
              entityId={row.entity}
              label={row.entity_name}
              accessToken={accessToken}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {row.entity_category} · {row.entity_status}
            {row.role_in_project && ` · ${row.role_in_project}`}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="text-xs">
            {row.entity_status}
          </Badge>
          {canEdit && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-xs gap-1"
              onClick={() => setConfirmOpen(true)}
            >
              <IconUnlink className="w-3.5 h-3.5" />
              Unlink
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from project?</DialogTitle>
            <DialogDescription>
              This only removes the link from your dossier. The underlying record stays in
              HeritageGraph.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void handleUnlink()}>
              {busy ? "Removing…" : "Unlink"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
