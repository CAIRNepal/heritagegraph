"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetchJson, getApiErrorMessage } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";
import { Lock, Unlock } from "lucide-react";

type ClusterRow = {
  id: string;
  canonical_label: string;
  locked: boolean;
  version: number;
};

export function IdentityClusterControls({
  cluster,
  token,
  onUpdated,
}: {
  cluster: ClusterRow | null;
  token: string | undefined;
  onUpdated: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!cluster || !token) {
    return null;
  }

  const base = getPublicApiUrl();

  const mutate = async (path: "lock" | "unlock") => {
    setBusy(true);
    try {
      await apiFetchJson(
        `${base}/api/v1/cidoc/entity-clusters/${encodeURIComponent(cluster.id)}/${path}/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason,
            expected_version: cluster.version,
          }),
        }
      );
      toast.success(path === "lock" ? "Cluster locked." : "Cluster unlocked.");
      setReason("");
      onUpdated();
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Cluster update failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-sm">
      <div className="font-medium">Cluster governance</div>
      <p className="text-xs text-muted-foreground">
        {cluster.canonical_label} — version {cluster.version}
        {cluster.locked ? " (locked)" : ""}
      </p>
      <div className="space-y-1">
        <Label className="text-xs">Reason (audit)</Label>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Short note for audit log"
          className="h-8 text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {!cluster.locked ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy}
            onClick={() => void mutate("lock")}
          >
            <Lock className="mr-1 h-3.5 w-3.5" aria-hidden />
            Lock
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={busy}
            onClick={() => void mutate("unlock")}
          >
            <Unlock className="mr-1 h-3.5 w-3.5" aria-hidden />
            Unlock
          </Button>
        )}
      </div>
    </div>
  );
}
