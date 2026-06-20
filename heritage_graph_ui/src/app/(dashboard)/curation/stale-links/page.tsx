"use client";

import { useCallback, useEffect, useState } from "react";
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
  IconAlertTriangle,
  IconCheck,
  IconExternalLink,
  IconLoader2,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";
import { glassCard, fadeInUp } from "@/lib/design";
import { motion } from "framer-motion";
import { useUserRoles } from "@/hooks/use-user-roles";
import { AccessDenied } from "@/components/access-denied";

interface ReconciledLinkDetail {
  id: string;
  entity_uri: string;
  match_type: string;
  target_uri: string;
  target_label: string;
  authority: string;
  is_stale: boolean;
  last_verified: string | null;
}

interface CuratorAlertRow {
  id: string;
  reconciled_link: string | null;
  reconciled_link_detail: ReconciledLinkDetail | null;
  issue_type: string;
  status: string;
  detail: string;
  detected_at: string;
  resolved_at: string | null;
  resolved_by_username: string | null;
  suggested_replacement_uri: string;
  created_at: string;
}

interface AlertsResponse {
  results?: CuratorAlertRow[];
  count?: number;
}

const ISSUE_LABELS: Record<string, string> = {
  stale_link: "Stale Link",
  label_drift: "Label Drift",
  supersession: "Assertion Superseded",
};

const ISSUE_COLORS: Record<string, string> = {
  stale_link: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  label_drift: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  supersession: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface AlertCardProps {
  alert: CuratorAlertRow;
  onResolve: (id: string) => Promise<void>;
  onIgnore: (id: string) => Promise<void>;
  onUpdateTarget: (linkId: string, newUri: string) => Promise<void>;
}

function AlertCard({ alert, onResolve, onIgnore, onUpdateTarget }: AlertCardProps) {
  const link = alert.reconciled_link_detail;
  const [busy, setBusy] = useState(false);

  const handle = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${glassCard} p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 flex-1 min-w-0">
          {link && (
            <>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 truncate">
                Entity:{" "}
                <a
                  href={link.entity_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono text-xs"
                >
                  {link.entity_uri}
                </a>
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">{link.match_type}Match</span>{" "}
                →{" "}
                <a
                  href={link.target_uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-500 hover:underline inline-flex items-center gap-0.5"
                >
                  {link.target_uri}
                  <IconExternalLink className="w-3 h-3" />
                </a>
                {link.target_label && (
                  <span className="ml-1 text-muted-foreground">
                    "{link.target_label}"
                  </span>
                )}
              </p>
            </>
          )}
          <p className="text-xs text-muted-foreground">{alert.detail}</p>
          <p className="text-xs text-muted-foreground">
            Detected: {formatDate(alert.detected_at)}
          </p>
        </div>
        <Badge className={ISSUE_COLORS[alert.issue_type] ?? ""}>
          <IconAlertTriangle className="w-3 h-3 mr-1" />
          {ISSUE_LABELS[alert.issue_type] ?? alert.issue_type}
        </Badge>
      </div>

      {alert.suggested_replacement_uri && (
        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 rounded-md px-3 py-1.5 border border-blue-200 dark:border-blue-800">
          Suggested replacement:{" "}
          <a
            href={alert.suggested_replacement_uri}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
          >
            {alert.suggested_replacement_uri}
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {alert.suggested_replacement_uri && link && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              handle(() =>
                onUpdateTarget(link.id, alert.suggested_replacement_uri)
              )
            }
            className="text-xs h-7"
          >
            <IconRefresh className="w-3 h-3 mr-1" />
            Update link
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => handle(() => onResolve(alert.id))}
          className="text-xs h-7 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
        >
          <IconCheck className="w-3 h-3 mr-1" />
          Resolve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handle(() => onIgnore(alert.id))}
          className="text-xs h-7 text-muted-foreground"
        >
          <IconX className="w-3 h-3 mr-1" />
          Ignore
        </Button>
      </div>
    </div>
  );
}

export default function StaleLinksPage() {
  const { data: session } = useSession();
  const { isReviewer, isModerator, isLoading: rolesLoading } = useUserRoles();
  const token = (session as { accessToken?: string } | null)?.accessToken;

  const [alerts, setAlerts] = useState<CuratorAlertRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const base = getPublicApiUrl();
    const params = new URLSearchParams({ status: statusFilter });
    try {
      const data = await apiFetchJson<AlertsResponse>(
        `${base}/api/curator-alerts/?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const list = Array.isArray(data)
        ? (data as CuratorAlertRow[])
        : (data.results ?? []);
      setAlerts(list);
      setCount(Array.isArray(data) ? list.length : (data.count ?? list.length));
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not load curator alerts."));
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleResolve = async (id: string) => {
    const base = getPublicApiUrl();
    try {
      await apiFetchJson(`${base}/api/curator-alerts/${id}/resolve/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      toast.success("Alert resolved.");
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not resolve alert."));
    }
  };

  const handleIgnore = async (id: string) => {
    const base = getPublicApiUrl();
    try {
      await apiFetchJson(`${base}/api/curator-alerts/${id}/ignore/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      toast.success("Alert ignored.");
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not ignore alert."));
    }
  };

  const handleUpdateTarget = async (linkId: string, newUri: string) => {
    const base = getPublicApiUrl();
    try {
      await apiFetchJson(`${base}/api/reconciled-links/${linkId}/update-target/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ target_uri: newUri }),
      });
      toast.success("Link updated.");
      void load();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Could not update link."));
    }
  };

  if (rolesLoading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isReviewer && !isModerator) {
    return <AccessDenied />;
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      className="max-w-3xl mx-auto py-6 space-y-4 px-4"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Stale Reconciliation Links
          </h1>
          <p className="text-sm text-muted-foreground">
            Authority links flagged by the weekly re-reconciliation check.
          </p>
        </div>
        {count > 0 && (
          <Badge variant="outline">
            {count} alert{count !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v)}
        >
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          className="h-8 text-xs"
        >
          <IconRefresh className="w-3.5 h-3.5 mr-1" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <IconLoader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {statusFilter === "open"
              ? "No open alerts — all authority links are healthy."
              : `No ${statusFilter} alerts found.`}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onResolve={handleResolve}
              onIgnore={handleIgnore}
              onUpdateTarget={handleUpdateTarget}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
