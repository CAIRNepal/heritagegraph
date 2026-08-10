"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fadeInUp } from "@/lib/design";

interface MergeRequestSummary {
  id: string;
  status: string;
  project_title: string;
  project_slug: string;
  opened_by_username: string;
  opened_at: string;
  conflict_diff: { added_count?: number; conflict_count?: number };
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  changes_requested: "bg-orange-100 text-orange-700",
  approved: "bg-blue-100 text-blue-700",
  merged: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function MergeRequestsPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<MergeRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.accessToken) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/merge-requests/`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : d.results ?? []))
      .finally(() => setLoading(false));
  }, [session]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <motion.div variants={fadeInUp} initial="hidden" animate="show">
        <h1 className="text-2xl font-bold">Merge Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and approve project contributions into the main graph.
        </p>
      </motion.div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">No merge requests found.</p>
      )}

      {!loading && items.map((mr, i) => (
        <motion.div
          key={mr.id}
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          transition={{ delay: i * 0.04 }}
          className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors"
        >
          <Link href={`/review/${mr.id}`} className="block space-y-1.5">
            <div className="flex items-center gap-2 justify-between">
              <p className="text-sm font-semibold">{mr.project_title}</p>
              <Badge className={STATUS_COLORS[mr.status] ?? "bg-muted text-muted-foreground"}>
                {mr.status.replace("_", " ")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Opened by {mr.opened_by_username} ·{" "}
              {new Date(mr.opened_at).toLocaleDateString()}
              {mr.conflict_diff?.added_count !== undefined && (
                <> · {mr.conflict_diff.added_count} triples</>
              )}
              {!!mr.conflict_diff?.conflict_count && (
                <> · {mr.conflict_diff.conflict_count} conflicts</>
              )}
            </p>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
