"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

type QueueRow = {
  entity_id: string;
  name: string;
  category?: string;
  status?: string;
  contributor?: {
    username?: string;
    contributor_score?: number;
  };
  days_in_review?: number;
};

export default function ReviewWorkspacePage() {
  const { data: session, status } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    const base = getPublicApiUrl();
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "80");
      if (filter !== "all") qs.set("queue_type", filter);
      const data = await apiFetchJson<{ results?: QueueRow[] } | QueueRow[]>(
        `${base}/api/v1/data/review-queue/?${qs.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }
      );
      const list = Array.isArray(data) ? data : data.results ?? [];
      setRows(list);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not load review queue."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).closest("input,textarea,select")) return;
      if (e.key === "j" || e.key === "J") {
        /* reserved: focus next */
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const bulkOpen = () => {
    for (const id of selected) {
      window.open(`/curation/review/${id}`, "_blank", "noopener,noreferrer");
    }
  };

  if (status === "loading") {
    return <div className="p-8 text-sm text-muted-foreground">Checking session…</div>;
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-8 text-center">
        <h1 className="text-xl font-semibold">Reviewer workspace</h1>
        <p className="text-sm text-muted-foreground">Sign in with a reviewer account to load the queue.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review workspace</h1>
          <p className="text-sm text-muted-foreground">
            Triage pending contributions. Open items in the classic workspace or bulk-open selected.
            Contributor score (when present) helps fast-track trusted authors.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "new_claims", "conflicts", "flagged", "expiring"] as const).map((q) => (
            <Button
              key={q}
              type="button"
              size="sm"
              variant={filter === q ? "default" : "outline"}
              onClick={() => setFilter(q)}
            >
              {q.replace(/_/g, " ")}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" variant="secondary" onClick={() => void load()} disabled={loading}>
          Refresh
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selected.size}
          onClick={bulkOpen}
        >
          Open selected ({selected.size})
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading queue…</p>
      ) : !rows.length ? (
        <p className="text-sm text-muted-foreground">No items in this queue filter.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((r) => (
            <li key={r.entity_id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <Checkbox
                checked={selected.has(r.entity_id)}
                onCheckedChange={() => toggle(r.entity_id)}
                aria-label={`Select ${r.name}`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  {r.category || "—"} · {r.status || "—"}
                  {typeof r.days_in_review === "number" ? ` · ${r.days_in_review}d in review` : ""}
                </div>
              </div>
              {typeof r.contributor?.contributor_score === "number" ? (
                <Badge variant="secondary" className="shrink-0">
                  score {r.contributor.contributor_score}
                </Badge>
              ) : null}
              <Button size="sm" className="shrink-0" asChild>
                <Link href={`/curation/review/${r.entity_id}`}>Open</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
