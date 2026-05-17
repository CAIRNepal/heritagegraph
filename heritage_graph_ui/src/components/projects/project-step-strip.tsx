"use client";

import { cn } from "@/lib/utils";
import type { ProjectDetail } from "@/lib/projects-api";

const STEPS = [
  { key: "identify", label: "Identify" },
  { key: "upload", label: "Upload" },
  { key: "author", label: "Author" },
  { key: "review", label: "Review" },
] as const;

function stepDone(key: string, project: ProjectDetail): boolean {
  switch (key) {
    case "identify":
      return Boolean(project.title?.trim());
    case "upload":
      return project.assets.length > 0;
    case "author":
      return project.entities.length > 0;
    case "review":
      return ["in_review", "approved", "merged", "needs_revision"].includes(project.state);
    default:
      return false;
  }
}

export function ProjectStepStrip({ project }: { project: ProjectDetail }) {
  return (
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
  );
}
