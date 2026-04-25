"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { ContributorMode } from "@/hooks/use-contributor-mode";

export function ContributorModeToggle({
  mode,
  onModeChange,
  isLoading,
  isSaving,
  className,
}: {
  mode: ContributorMode;
  onModeChange: (mode: ContributorMode) => void;
  isLoading?: boolean;
  isSaving?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card/80 p-3", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Contributor mode</p>
        <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
          {mode}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Basic focuses on essentials and hides optional detail by default. Advanced shows full ontology detail.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "basic" ? "default" : "outline"}
          disabled={Boolean(isLoading) || Boolean(isSaving)}
          onClick={() => onModeChange("basic")}
        >
          Basic
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "advanced" ? "default" : "outline"}
          disabled={Boolean(isLoading) || Boolean(isSaving)}
          onClick={() => onModeChange("advanced")}
        >
          Advanced
        </Button>
      </div>
    </div>
  );
}
