"use client";

import { cn } from "@/lib/utils";
import type { ProjectDetail } from "@/lib/projects-api";

const STEPS = [
  { key: "identify", label: "Describe" },
  { key: "upload", label: "Evidence" },
  { key: "author", label: "Entities" },
  { key: "review", label: "Review" },
] as const;

function ocrIsIdle(asset: ProjectDetail["assets"][number]): boolean {
  return !["pending", "processing"].includes(asset.ocr_status);
}

function stepDone(key: string, project: ProjectDetail): boolean {
  switch (key) {
    case "identify":
      return Boolean(project.title?.trim() && project.abstract?.trim());
    case "upload":
      return (
        project.assets.length > 0 &&
        project.assets.every(ocrIsIdle)
      );
    case "author":
      return project.entities.length > 0;
    case "review":
      return ["in_review", "approved", "merged", "needs_revision"].includes(project.state);
    default:
      return false;
  }
}

export function ProjectStepStrip({
  project,
  submissionBlockers = [],
}: {
  project: ProjectDetail;
  submissionBlockers?: string[];
}) {
  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((step, i) => {
          const done = stepDone(step.key, project);
          return (
            <li key={step.key} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border",
                  done
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
                    : "bg-muted/50 border-border text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold",
                    done ? "bg-emerald-600 text-white" : "bg-muted-foreground/30"
                  )}
                >
                  {i + 1}
                </span>
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="text-muted-foreground/50 hidden sm:inline">→</span>
              )}
            </li>
          );
        })}
      </ol>

      {submissionBlockers.length > 0 && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2"
          role="alert"
          aria-live="polite"
        >
          <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200 mb-1.5">
            Before you can submit for review:
          </p>
          <ul className="list-disc list-inside text-[11px] text-amber-900/90 dark:text-amber-100/90 space-y-0.5">
            {submissionBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
