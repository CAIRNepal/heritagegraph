"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/access-denied";
import { fadeInUp, glassCard } from "@/lib/design";
import { getApiErrorMessage } from "@/lib/api-client";
import { useUserRoles } from "@/hooks/use-user-roles";
import {
  listProjectsPage,
  PROJECT_STATE_LABELS,
  type ProjectSummary,
} from "@/lib/projects-api";

export default function ProjectsReviewQueuePage() {
  const { data: session, status } = useSession();
  const { isReviewer, isModerator, isLoading: rolesLoading } = useUserRoles();
  const [rows, setRows] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = (session as { accessToken?: string } | null)?.accessToken;
    if (rolesLoading || status === "loading") return;
    if (!token || !(isReviewer || isModerator)) return;
    setLoading(true);
    setError(null);
    listProjectsPage(token, { state: "in_review", ordering: "submitted_at" })
      .then((page) => setRows(page.results))
      .catch((e) => setError(getApiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [session, status, rolesLoading, isReviewer, isModerator]);

  if (!rolesLoading && status === "authenticated" && !(isReviewer || isModerator)) {
    return <AccessDenied requiredRole="reviewer" userEmail={session?.user?.email} />;
  }

  const tokenReady = !!(session as { accessToken?: string } | null)?.accessToken;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <motion.div initial="hidden" animate="show" variants={fadeInUp} className="space-y-1">
        <h1 className="text-2xl font-bold">Project dossiers — in review</h1>
        <p className="text-sm text-muted-foreground">
          Submitted contributor projects awaiting approval. Open the workspace to approve, request a
          revision, or withdraw.
        </p>
      </motion.div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {(loading || !tokenReady || rolesLoading) && (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading queue…</p>
      )}
      {!loading && tokenReady && !error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center border rounded-xl bg-muted/20">
          No projects are awaiting review right now.
        </p>
      )}
      {!loading &&
        rows.length > 0 &&
        rows.map((p) => (
          <motion.div
            key={p.id}
            initial="hidden"
            animate="show"
            variants={fadeInUp}
            className={`${glassCard} p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-base truncate">{p.title}</h2>
                <Badge variant="secondary" className="text-[10px]">
                  {PROJECT_STATE_LABELS[p.state] ?? p.state}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {p.owner.username} · {p.slug} · {p.entity_count} entities · {p.asset_count} assets
              </p>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <Link href={`/contribute/projects/${encodeURIComponent(p.slug)}`}>Open</Link>
            </Button>
          </motion.div>
        ))}
    </div>
  );
}
