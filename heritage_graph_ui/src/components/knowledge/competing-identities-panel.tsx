"use client";

import { Badge } from "@/components/ui/badge";

export type IdentitySummaryCluster = {
  cluster_id: string;
  canonical_label: string;
  locked: boolean;
  members: Array<{
    entity_type: string;
    entity_id: number;
    display_title: string;
    membership_assertion_id: string;
  }>;
};

export type IdentitySummaryPayload = {
  competing: boolean;
  canonical_label: string | null;
  primary_cluster_id?: string | null;
  source_type_order: string[];
  clusters: IdentitySummaryCluster[];
};

export function CompetingIdentitiesPanel({ summary }: { summary: IdentitySummaryPayload }) {
  if (!summary.competing || !summary.clusters?.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-amber-200/80 bg-amber-50/40 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
          Competing identities
        </h4>
        <Badge variant="outline" className="text-[10px]">
          No single canonical winner
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Multiple accepted clusters reference this record. Evidence is ordered using the
        server&apos;s source-type ranking: {summary.source_type_order.join(" → ")}.
      </p>
      <ul className="mt-3 space-y-3">
        {summary.clusters.map((c) => (
          <li key={c.cluster_id} className="rounded border bg-background/80 p-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{c.canonical_label}</span>
              <span className="text-[10px] text-muted-foreground">
                cluster {c.cluster_id.slice(0, 8)}…
                {c.locked ? " · locked" : ""}
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {c.members.map((m) => (
                <li key={m.membership_assertion_id}>
                  {m.entity_type}#{m.entity_id}: {m.display_title}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
