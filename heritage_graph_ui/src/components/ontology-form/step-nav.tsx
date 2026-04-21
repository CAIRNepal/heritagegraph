"use client";

import { cn } from "@/lib/utils";

export function StepNav({
  sections,
  currentStep,
  onStepClick,
  sectionProgress,
}: {
  sections: { key: string; label: string }[];
  currentStep: number;
  onStepClick: (idx: number) => void;
  sectionProgress: Record<
    string,
    { filled: number; total: number; requiredOk: boolean }
  >;
}) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto pb-2">
      {sections.map((section, idx) => {
        const progress = sectionProgress[section.key];
        const isCurrent = idx === currentStep;
        const isComplete =
          progress?.filled === progress?.total && progress?.total > 0;
        const hasRequiredMissing = !progress?.requiredOk;

        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onStepClick(idx)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              isCurrent
                ? "bg-blue-600 text-white shadow-sm"
                : isComplete
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                isCurrent
                  ? "bg-white/20 text-white"
                  : isComplete
                    ? "bg-emerald-500 text-white"
                    : hasRequiredMissing
                      ? "bg-muted-foreground/20 text-muted-foreground"
                      : "bg-muted-foreground/20 text-muted-foreground"
              )}
            >
              {isComplete ? "✓" : idx + 1}
            </span>
            <span className="hidden sm:inline">{section.label}</span>
            <span
              className="sm:hidden max-w-[5.5rem] truncate text-[11px] leading-tight text-left"
              title={section.label}
            >
              {section.label.split(/\s+/)[0] || section.label.slice(0, 10)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
