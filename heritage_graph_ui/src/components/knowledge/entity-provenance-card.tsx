"use client";

import { History } from "lucide-react";
import type { ContributorPresentation } from "@/lib/knowledge/entity-view-utils";
import { formatDate } from "@/lib/knowledge/entity-view-utils";
import { cn } from "@/lib/utils";

interface EntityProvenanceCardProps {
  createdAt?: string;
  updatedAt?: string;
  contributor: ContributorPresentation | null;
  className?: string;
}

export function EntityProvenanceCard({
  createdAt,
  updatedAt,
  contributor,
  className,
}: EntityProvenanceCardProps) {
  const showUpdated = updatedAt && updatedAt !== createdAt;
  if (!createdAt && !contributor) {
    return null;
  }

  const who = contributor?.label?.trim();
  const primaryLine =
    createdAt && who
      ? `Created by ${who} on ${formatDate(createdAt)}`
      : createdAt
        ? `Created on ${formatDate(createdAt)}`
        : who
          ? `Contributor: ${who}`
          : null;

  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        Provenance
      </h3>
      {primaryLine ? <p className="text-sm text-foreground">{primaryLine}</p> : null}
      {showUpdated ? (
        <p className="mt-1.5 text-xs text-muted-foreground">Updated {formatDate(updatedAt!)}</p>
      ) : null}
      {contributor?.email ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{contributor.email}</p>
      ) : null}
    </div>
  );
}
