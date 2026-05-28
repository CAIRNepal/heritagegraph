"use client";

import { Badge } from "@/components/ui/badge";
import { glassCard } from "@/lib/design";
import type { ProjectActivityRow, ProjectDetail } from "@/lib/projects-api";

function revisionNotes(activity: ProjectActivityRow[]): string[] {
  return activity
    .filter((a) => a.action === "state_changed")
    .map((a) => {
      const payload = a.payload ?? {};
      if (payload.to !== "needs_revision") return null;
      const comment = typeof payload.comment === "string" ? payload.comment.trim() : "";
      return comment || null;
    })
    .filter((c): c is string => Boolean(c));
}

export function ProjectReviewerPanel({
  project,
  activity,
}: {
  project: ProjectDetail;
  activity: ProjectActivityRow[];
}) {
  if (project.state !== "in_review" && project.state !== "needs_revision") {
    return null;
  }

  const notes = revisionNotes(activity);
  const ocrPending = project.assets.filter(
    (a) => a.ocr_status === "pending" || a.ocr_status === "processing"
  ).length;

  return (
    <aside className={`${glassCard} p-4 space-y-4 lg:sticky lg:top-4`}>
      <div>
        <h3 className="text-sm font-semibold">Reviewer summary</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Dossier-level review. Approve, request revision, or merge from the actions above.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Entities</dt>
          <dd className="font-medium">{project.entities.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Assets</dt>
          <dd className="font-medium">{project.assets.length}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">OCR in flight</dt>
          <dd className="font-medium">{ocrPending}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Submitted</dt>
          <dd className="font-medium text-xs">
            {project.submitted_at
              ? new Date(project.submitted_at).toLocaleDateString()
              : "—"}
          </dd>
        </div>
      </dl>
      {project.state === "in_review" && (
        <Badge variant="outline" className="text-xs">
          Awaiting decision
        </Badge>
      )}
      {notes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Revision notes</p>
          {notes.map((note, i) => (
            <p
              key={`${i}-${note.slice(0, 24)}`}
              className="text-xs rounded-md border bg-muted/30 p-2 whitespace-pre-wrap"
            >
              {note}
            </p>
          ))}
        </div>
      )}
    </aside>
  );
}
