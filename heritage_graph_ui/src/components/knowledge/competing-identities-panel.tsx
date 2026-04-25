"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type IdentitySummaryCluster = {
  cluster_id: string;
  canonical_label: string;
  locked: boolean;
  evidence_count?: number;
  best_source_type?: string | null;
  best_source_rank?: number | null;
  subject_membership_chain?: Array<{
    assertion_id: string;
    source_type?: string | null;
    source_name?: string | null;
    source_rank?: number;
    confidence?: string;
    reconciliation_status?: string;
    contributed_by?: string;
    source_citation?: string;
    assertion_content?: string;
    created_at?: string;
  }>;
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
  alias_titles?: string[];
  membership_assertion_ids?: string[];
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
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{c.canonical_label}</span>
                  {c.best_source_rank != null && (
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-[9px] uppercase font-bold px-1.5 h-4",
                        c.best_source_rank === 1 ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-400" :
                        c.best_source_rank <= 2 ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300" :
                        "bg-muted text-muted-foreground"
                      )}
                    >
                      {c.best_source_rank === 1 ? "Top Tier" : `Rank ${c.best_source_rank}`}
                    </Badge>
                  )}
                </div>
                {c.best_source_type ? (
                  <p className="text-[10px] text-muted-foreground">
                    primary source: <span className="text-foreground/70 italic">{c.best_source_type}</span>
                  </p>
                ) : null}
              </div>
              <div className="text-right text-[10px] text-muted-foreground">
                <p className="font-mono">
                  cluster {c.cluster_id.slice(0, 8)}
                  {c.locked ? " · 🔒 locked" : ""}
                </p>
                <p className="mt-0.5">{c.evidence_count ?? c.subject_membership_chain?.length ?? 0} supporting claim(s)</p>
              </div>
            </div>

            {c.subject_membership_chain?.length ? (
              <div className="mt-2 rounded border border-muted/70 bg-muted/20 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Membership evidence chain
                </p>
                <ul className="mt-1.5 space-y-1.5 text-xs">
                  {c.subject_membership_chain.map((row) => (
                    <li key={row.assertion_id} className="rounded border bg-background/70 p-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">
                          {row.source_type || "unknown source"}
                          {row.source_rank != null ? ` (#${row.source_rank})` : ""}
                        </span>
                        <span className="text-muted-foreground">
                          {row.confidence || "unknown confidence"} · {row.reconciliation_status || "pending"}
                        </span>
                      </div>
                      {row.source_name || row.source_citation ? (
                        <p className="mt-0.5 text-muted-foreground">
                          {row.source_name || ""}
                          {row.source_name && row.source_citation ? " · " : ""}
                          {row.source_citation || ""}
                        </p>
                      ) : null}
                      {row.assertion_content ? (
                        <p className="mt-1 line-clamp-2 text-muted-foreground">{row.assertion_content}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

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
