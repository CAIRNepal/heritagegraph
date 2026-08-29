"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconArrowLeft,
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconLoader2,
  IconReplace,
  IconCheck,
  IconCircleDashed,
} from "@tabler/icons-react";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";
import { glassCard, fadeInUp } from "@/lib/design";
import { motion } from "framer-motion";

interface SupersedesInfo {
  id: string;
  asserted_property: string;
  asserted_value: string;
  reconciliation_status: string;
}

interface AssertionRow {
  id: string;
  asserted_property: string;
  asserted_value: string;
  confidence: string;
  reconciliation_status: string;
  created_at: string;
  updated_at: string;
  supersedes: SupersedesInfo | null;
  content_type: string | null;
  object_id: string | null;
}

interface HistoryResponse {
  count: number;
  page: number;
  page_size: number;
  results: AssertionRow[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  disputed: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  superseded: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  confirmed: "confirmed",
  likely: "likely",
  possible: "possible",
  unlikely: "unlikely",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AssertionCard({ row }: { row: AssertionRow }) {
  return (
    <div className={`${glassCard} p-4 space-y-2`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-sm font-medium text-primary dark:text-primary truncate">
            <span className="font-mono text-xs text-primary dark:text-primary mr-1">
              {row.asserted_property}
            </span>
            ={" "}
            <span className="font-semibold">{row.asserted_value || "—"}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {row.content_type && row.object_id && (
              <span className="mr-2">
                Entity:{" "}
                <span className="font-mono">
                  {row.content_type}#{row.object_id}
                </span>
              </span>
            )}
            {row.confidence && (
              <span>
                confidence:{" "}
                <span className="font-medium">
                  {CONFIDENCE_LABELS[row.confidence] ?? row.confidence}
                </span>
              </span>
            )}
          </p>
        </div>
        <Badge className={STATUS_COLORS[row.reconciliation_status] ?? ""}>
          {row.reconciliation_status === "accepted" && (
            <IconCheck className="w-3 h-3 mr-1" />
          )}
          {row.reconciliation_status === "superseded" && (
            <IconReplace className="w-3 h-3 mr-1" />
          )}
          {row.reconciliation_status === "pending" && (
            <IconCircleDashed className="w-3 h-3 mr-1" />
          )}
          {row.reconciliation_status}
        </Badge>
      </div>

      {row.supersedes && (
        <div className="flex items-center gap-2 text-xs rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-1.5">
          <IconReplace className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-amber-700 dark:text-amber-300">
            SUPERSEDES{" "}
            <span className="font-mono">{row.supersedes.asserted_property}</span>
            {" = "}
            <span className="line-through text-amber-600/70 dark:text-amber-400/60">
              {row.supersedes.asserted_value}
            </span>
          </span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
    </div>
  );
}

export default function ProjectHistoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [rows, setRows] = useState<AssertionRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");

  const load = useCallback(async () => {
    if (!token || !slug) return;
    setLoading(true);
    const base = getPublicApiUrl();
    const params = new URLSearchParams({ project_slug: slug, page: String(page) });
    if (entityTypeFilter !== "all") params.set("entity_type", entityTypeFilter);
    try {
      const data = await apiFetchJson<HistoryResponse>(
        `${base}/api/project-assertion-history/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRows(data.results ?? []);
      setCount(data.count ?? 0);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not load assertion history."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, slug, page, entityTypeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      className="max-w-3xl mx-auto py-6 space-y-4 px-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/contribute/projects/${slug}`}>
            <IconArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          Assertion History
        </h1>
        {count > 0 && (
          <Badge variant="outline" className="ml-auto">
            {count} assertion{count !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select
          value={entityTypeFilter}
          onValueChange={(v) => {
            setEntityTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="All entity types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entity types</SelectItem>
            <SelectItem value="architecturalstructure">
              Architectural Structure
            </SelectItem>
            <SelectItem value="deity">Deity</SelectItem>
            <SelectItem value="festival">Festival</SelectItem>
            <SelectItem value="person">Person</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No assertions recorded yet for this project.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <AssertionCard key={row.id} row={row} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <IconChevronLeft className="w-4 h-4 mr-1" />
            Older
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Newer
            <IconChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </motion.div>
  );
}
