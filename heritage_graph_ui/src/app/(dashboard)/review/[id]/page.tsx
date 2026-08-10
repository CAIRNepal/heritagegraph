"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { fadeInUp } from "@/lib/design";

// ── types ──────────────────────────────────────────────────────────────────────

interface MergeRequest {
  id: string;
  status: string;
  scope: string;
  summary: string;
  justification: string;
  project_title: string;
  project_slug: string;
  opened_by_username: string;
  reviewed_by_username: string | null;
  reviewer_note: string;
  conflict_diff: {
    added_count?: number;
    removed_count?: number;
    conflict_count?: number;
    added_subjects?: string[];
    conflicting_triples?: Array<{
      subject: string;
      predicate: string;
      project_value: string;
      main_value: string;
    }>;
  };
  shacl_report: { conforms: boolean; violations?: unknown[] };
  new_pids: string[];
  merge_activity_uri: string;
  opened_at: string;
  merged_at: string | null;
}

interface RdfDiff {
  added_count: number;
  removed_count: number;
  conflict_count: number;
  added_subjects: string[];
  conflicting_triples: Array<{
    subject: string;
    predicate: string;
    project_value: string;
    main_value: string;
  }>;
}

// ── status badge ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  changes_requested: "bg-orange-100 text-orange-700",
  approved: "bg-blue-100 text-blue-700",
  merged: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

// ── component ─────────────────────────────────────────────────────────────────

export default function ReviewMergeRequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const [mr, setMr] = useState<MergeRequest | null>(null);
  const [rdfDiff, setRdfDiff] = useState<RdfDiff | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Reviewer checklist
  const [checkedSource, setCheckedSource] = useState(false);
  const [checkedDocActivity, setCheckedDocActivity] = useState(false);
  const [verificationNote, setVerificationNote] = useState("");
  const [diffFilter, setDiffFilter] = useState<"all" | "added" | "conflicts">("all");

  useEffect(() => {
    if (!session?.accessToken || !id) return;
    const headers = { Authorization: `Bearer ${session.accessToken}` };

    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/merge-requests/${id}/`, { headers })
        .then((r) => r.json()),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/merge-requests/${id}/rdf-diff/`, { headers })
        .then((r) => r.json()),
    ])
      .then(([mrData, diffData]) => {
        setMr(mrData);
        setRdfDiff(diffData);
      })
      .catch(() => toast.error("Failed to load merge request."))
      .finally(() => setLoading(false));
  }, [session, id]);

  async function doAction(action: "approve" | "reject" | "request-changes") {
    if (!session?.accessToken || !mr) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/merge-requests/${mr.id}/${action}/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reviewer_note: verificationNote }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.detail ?? `${action} failed.`);
        return;
      }
      setMr(data);
      if (action === "approve") {
        toast.success("Merge request approved and merged.");
      } else if (action === "reject") {
        toast.info("Merge request rejected.");
      } else {
        toast.info("Changes requested — contributor notified.");
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!mr) {
    return <div className="p-6 text-sm text-muted-foreground">Merge request not found.</div>;
  }

  // Show post-merge notification if merged
  if (mr.status === "merged") {
    return <PostMergeView mr={mr} />;
  }

  const filteredSubjects = (rdfDiff?.added_subjects ?? []).filter((s) => {
    if (diffFilter === "all") return true;
    if (diffFilter === "added") return true;
    return false;
  });

  const filteredConflicts = (rdfDiff?.conflicting_triples ?? []).filter(() =>
    diffFilter === "all" || diffFilter === "conflicts"
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      {/* Header */}
      <motion.div variants={fadeInUp} initial="hidden" animate="show" className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">Merge Request</h1>
            <Badge className={STATUS_COLORS[mr.status] ?? ""}>{mr.status}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {mr.project_title} · Opened by {mr.opened_by_username} ·{" "}
            {new Date(mr.opened_at).toLocaleDateString()}
            {mr.reviewed_by_username && ` · Reviewer: ${mr.reviewed_by_username}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          ← Back
        </Button>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="diff">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="diff">RDF Diff</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
        </TabsList>

        {/* Summary tab */}
        <TabsContent value="summary" className="space-y-3 pt-3">
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium">Summary</p>
            <p className="text-sm text-muted-foreground">{mr.summary || "—"}</p>
            {mr.justification && (
              <>
                <p className="text-sm font-medium mt-2">Justification</p>
                <p className="text-sm text-muted-foreground">{mr.justification}</p>
              </>
            )}
          </div>
          {rdfDiff && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="text-green-600">+ {rdfDiff.added_count} triples added</Badge>
              {rdfDiff.conflict_count > 0 && (
                <Badge variant="secondary" className="text-amber-600">~ {rdfDiff.conflict_count} conflicts</Badge>
              )}
              <Badge variant="secondary">- {rdfDiff.removed_count} removed</Badge>
            </div>
          )}
        </TabsContent>

        {/* RDF Diff tab */}
        <TabsContent value="diff" className="space-y-3 pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Show:</span>
            {(["all", "added", "conflicts"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setDiffFilter(f)}
                className={`rounded px-2 py-0.5 border transition-colors ${
                  diffFilter === f
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {f === "all" ? "All" : f === "added" ? "Added only" : "Conflicts only"}
              </button>
            ))}
          </div>

          <div className="rounded-lg border bg-muted/30 divide-y font-mono text-xs max-h-80 overflow-y-auto">
            {filteredSubjects.length === 0 && filteredConflicts.length === 0 && (
              <div className="p-3 text-muted-foreground">No triples to display.</div>
            )}

            {filteredSubjects.map((subj, i) => (
              <div key={i} className="p-2 space-y-0.5">
                <div className="text-green-700 dark:text-green-400 font-semibold">
                  + {shortIri(subj)}
                </div>
                {(mr.conflict_diff?.conflicting_triples ?? [])
                  .filter((t) => t.subject === subj)
                  .slice(0, 5)
                  .map((t, j) => (
                    <div key={j} className="ml-4 text-muted-foreground">
                      {shortIri(t.predicate)}{" "}
                      <span className="text-foreground">&ldquo;{shortIri(t.project_value)}&rdquo;</span>
                    </div>
                  ))}
              </div>
            ))}

            {filteredConflicts.map((t, i) => (
              <div key={i} className="p-2 space-y-0.5 bg-amber-50/50 dark:bg-amber-900/10">
                <div className="text-amber-700 font-semibold">~ Conflict: {shortIri(t.subject)}</div>
                <div className="ml-4 text-muted-foreground">
                  {shortIri(t.predicate)}:{" "}
                  <span className="text-green-600">&ldquo;{shortIri(t.project_value)}&rdquo;</span>
                  {" vs "}
                  <span className="text-muted-foreground">&ldquo;{shortIri(t.main_value)}&rdquo;</span>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Sources tab */}
        <TabsContent value="sources" className="pt-3">
          <p className="text-sm text-muted-foreground">
            Source completeness check is performed during SHACL validation.
            {mr.shacl_report?.conforms
              ? " ✓ All entities link a DataSource."
              : " ✗ Some assertions may be missing a DataSource — see SHACL report."}
          </p>
        </TabsContent>
      </Tabs>

      {/* Reviewer checklist */}
      {(mr.status === "pending" || mr.status === "changes_requested") && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.08 }}
          className="rounded-lg border bg-card p-4 space-y-4"
        >
          <h3 className="text-sm font-semibold">Reviewer checklist</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="chk-source"
                checked={checkedSource}
                onCheckedChange={(v) => setCheckedSource(!!v)}
              />
              <Label htmlFor="chk-source" className="text-sm cursor-pointer">
                Every entity traces to a DataSource
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="chk-doc"
                checked={checkedDocActivity}
                onCheckedChange={(v) => setCheckedDocActivity(!!v)}
              />
              <Label htmlFor="chk-doc" className="text-sm cursor-pointer">
                DocumentationActivity present
              </Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="verification-note" className="text-sm">
              Verification note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="verification-note"
              rows={2}
              placeholder="Cross-checked against DoA 1975 survey — consistent"
              value={verificationNote}
              onChange={(e) => setVerificationNote(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => doAction("request-changes")}
              disabled={actionLoading}
            >
              Request Changes
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => doAction("reject")}
              disabled={actionLoading}
            >
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => doAction("approve")}
              disabled={actionLoading}
              className="ml-auto"
            >
              {actionLoading ? "Processing…" : "Approve & Merge →"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Post-merge notification ───────────────────────────────────────────────────

function PostMergeView({ mr }: { mr: MergeRequest }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-2 text-green-600">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <h1 className="text-xl font-bold">Merge Request — Merged</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Your contribution is now part of the HeritageGraph knowledge base.
      </p>

      {mr.new_pids.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <p className="text-sm font-semibold">New global PIDs</p>
          <ul className="space-y-1 font-mono text-xs text-muted-foreground">
            {mr.new_pids.map((pid, i) => (
              <li key={i}>{pid}</li>
            ))}
          </ul>
        </div>
      )}

      {mr.merge_activity_uri && (
        <div className="rounded-lg border bg-card p-4 space-y-1">
          <p className="text-sm font-semibold">Merge activity</p>
          <p className="font-mono text-xs text-muted-foreground break-all">
            {mr.merge_activity_uri}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/knowledge/entity">View entities in Atlas →</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/knowledge/sparql">Query SPARQL endpoint →</Link>
        </Button>
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────

function shortIri(iri: string): string {
  const last = iri.split(/[/#]/).filter(Boolean).pop() ?? iri;
  return last.length > 60 ? `${last.slice(0, 60)}…` : last;
}
