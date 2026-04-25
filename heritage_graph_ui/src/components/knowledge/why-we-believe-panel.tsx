"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";
import { djangoModelNameFromOntologyKey } from "@/lib/knowledge/cidoc-api-path";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconInfoCircle,
  IconClock,
  IconShieldCheck,
  IconAlertCircle,
  IconSearch,
  IconGitFork,
} from "@tabler/icons-react";
import {
  CompetingIdentitiesPanel,
  type IdentitySummaryPayload,
} from "@/components/knowledge/competing-identities-panel";

type HeritageAssertionRow = {
  id: string;
  asserted_property?: string;
  asserted_value?: string;
  assertion_content?: string;
  confidence?: string;
  reconciliation_status?: string;
  contributed_by?: string;
  source_citation?: string;
};

export function WhyWeBelievePanel({
  domain,
  cidocRecordId,
  culturalEntityId,
}: {
  domain: string;
  cidocRecordId: string;
  culturalEntityId: string | null;
}) {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const [rows, setRows] = useState<HeritageAssertionRow[]>([]);
  const [summary, setSummary] = useState<IdentitySummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const base = getPublicApiUrl();
    const ct = djangoModelNameFromOntologyKey(domain);
    setLoading(true);
    setSummary(null);
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const sumPromise = apiFetchJson<IdentitySummaryPayload>(
        `${base}/api/v1/cidoc/identity-summary/?entity_type=${encodeURIComponent(ct)}&entity_id=${encodeURIComponent(cidocRecordId)}`,
        { headers }
      ).catch(() => null);
      const bySubject = await apiFetchJson<{ results?: HeritageAssertionRow[] } | HeritageAssertionRow[]>(
        `${base}/api/v1/cidoc/assertions/?entity_type=${encodeURIComponent(ct)}&entity_id=${encodeURIComponent(cidocRecordId)}`,
        { headers }
      );
      const listA = Array.isArray(bySubject) ? bySubject : bySubject.results ?? [];
      let merged = [...listA];
      if (culturalEntityId) {
        const byCe = await apiFetchJson<{ results?: HeritageAssertionRow[] } | HeritageAssertionRow[]>(
          `${base}/api/v1/cidoc/assertions/?cultural_entity_id=${encodeURIComponent(culturalEntityId)}`,
          { headers }
        );
        const listB = Array.isArray(byCe) ? byCe : byCe.results ?? [];
        const seen = new Set(merged.map((r) => r.id));
        for (const r of listB) {
          if (!seen.has(r.id)) {
            merged.push(r);
            seen.add(r.id);
          }
        }
      }
      setRows(merged);
      const sum = await sumPromise;
      setSummary(sum);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not load assertions."));
      setRows([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [cidocRecordId, culturalEntityId, domain, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = rows.reduce<Record<string, HeritageAssertionRow[]>>((acc, r) => {
    const k = (r.asserted_property || "(general)").trim() || "(general)";
    acc[k] = acc[k] || [];
    acc[k].push(r);
    return acc;
  }, {});

  const reconcile = async (id: string, status: string) => {
    const base = getPublicApiUrl();
    if (!token) {
      toast.error("Sign in as a reviewer to reconcile.");
      return;
    }
    try {
      await apiFetchJson(`${base}/api/v1/cidoc/assertions/${id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reconciliation_status: status }),
      });
      toast.success("Assertion updated.");
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not update assertion."));
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Loading provenance…
      </div>
    );
  }

  const hasIdentityBlock =
    summary &&
    (summary.competing ||
      summary.canonical_label ||
      (summary.membership_assertion_ids && summary.membership_assertion_ids.length > 0));

  if (!rows.length && !hasIdentityBlock) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        No structured assertions are recorded for this record yet. Contributions and OCR runs will
        appear here as the pipeline attaches them.
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Why we believe this</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          HeritageAssertion rows grouped by property. Reviewers can mark reconciliation status when
          sources disagree.
        </p>
      </div>
      {summary && hasIdentityBlock ? (
        <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/50 to-white p-4 shadow-sm dark:border-blue-900/30 dark:from-blue-950/20 dark:to-background">
          <div className="absolute -right-4 -top-4 text-blue-500/10">
            <IconGitFork size={80} />
          </div>
          <div className="relative space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-[10px] uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Identity Cluster
              </Badge>
              {summary.primary_cluster_id ? (
                <span className="font-mono text-[10px] text-muted-foreground opacity-70">
                  #{summary.primary_cluster_id.slice(0, 8)}
                </span>
              ) : null}
            </div>
            
            <div className="space-y-1">
              {summary.canonical_label ? (
                <h4 className="text-base font-bold text-foreground">
                  {summary.canonical_label}
                </h4>
              ) : null}
              {summary.alias_titles?.length ? (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Known aliases: <span className="text-foreground/80">{summary.alias_titles.join(", ")}</span>
                </p>
              ) : null}
            </div>

            {summary.competing ? (
              <div className="mt-2 border-t border-blue-100/50 pt-3 dark:border-blue-900/20">
                <CompetingIdentitiesPanel summary={summary} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="space-y-4 max-h-[32rem] overflow-y-auto pr-1">
        {!rows.length ? (
          <p className="text-xs text-muted-foreground">No additional assertion rows for this view.</p>
        ) : null}
        {Object.entries(grouped).map(([prop, list]) => (
          <div key={prop} className="rounded-md border bg-muted/20 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {prop}
            </div>
            <ul className="mt-2 space-y-2">
              {list.map((r) => (
                <li
                  key={r.id}
                  className="rounded border bg-background/80 p-2 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="break-words font-medium">{r.asserted_value || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.contributed_by ? `By ${r.contributed_by}` : null}
                        {r.source_citation ? ` · ${r.source_citation}` : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {r.confidence ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {r.confidence}
                        </Badge>
                      ) : null}
                      {r.reconciliation_status ? (
                        <Badge variant="outline" className="text-[10px]">
                          {r.reconciliation_status}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  {token ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => void reconcile(r.id, "accepted")}
                      >
                        Mark accepted
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => void reconcile(r.id, "superseded")}
                      >
                        Superseded
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
