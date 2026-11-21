"use client";

import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatStatusLabel } from "@/lib/knowledge/entity-view-utils";

interface EntityViewHeaderProps {
  displayName: string;
  entityTypeLabel: string;
  status?: string;
  subtitleParts: string[];
  onBack: () => void;
  backAriaLabel: string;
  actions: ReactNode;
  className?: string;
}

export function EntityViewHeader({
  displayName,
  entityTypeLabel,
  status,
  subtitleParts,
  onBack,
  backAriaLabel,
  actions,
  className,
}: EntityViewHeaderProps) {
  const subtitle = subtitleParts.filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "sticky top-0 z-30 -mx-4 mb-6 border-b bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60",
        className,
      )}
    >
      <div className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onBack}
              aria-label={backAriaLabel}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-2">
                <h1 className="min-w-0 text-xl font-bold leading-snug tracking-tight text-foreground break-words sm:text-2xl">
                  {displayName}
                </h1>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="shrink-0 text-xs font-medium">
                    {entityTypeLabel}
                  </Badge>
                  {status ? (
                    <Badge
                      variant={
                        status === "accepted"
                          ? "default"
                          : status === "rejected"
                            ? "destructive"
                            : "outline"
                      }
                      className="shrink-0 border-border/80 text-xs font-medium"
                    >
                      {formatStatusLabel(status)}
                    </Badge>
                  ) : null}
                </div>
              </div>
              {subtitle ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 pl-12 sm:w-auto sm:shrink-0 sm:justify-end sm:pl-0">
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
}
