"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiFetchJson } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { getContributePathForRegistryKey } from "@/lib/ontology/contribute-intent-routes";

interface ClusterMember {
  entity_id: number;
  display_title: string;
  registry_key?: string | null;
  completeness_score?: number;
  status?: string | null;
}

interface DuplicateHint {
  id: string;
  canonical_label: string;
  type_scope: string;
  registry_key?: string | null;
  member_count?: number;
  canonical_member?: ClusterMember | null;
  members?: ClusterMember[];
  recommendation?: string;
}

interface DuplicateResponse {
  results?: DuplicateHint[];
  recommendation?: string;
}

export function DuplicateContributionAlert({
  label,
  registryKey,
  accessToken,
  disabled = false,
}: {
  label?: string;
  registryKey: string;
  accessToken?: string;
  disabled?: boolean;
}) {
  const { registry } = useOntology();
  const [hints, setHints] = useState<DuplicateHint[]>([]);
  const [recommendation, setRecommendation] = useState<string>("create_new");
  const [loading, setLoading] = useState(false);

  const trimmed = label?.trim() ?? "";

  useEffect(() => {
    if (disabled || !accessToken || trimmed.length < 3) {
      setHints([]);
      setRecommendation("create_new");
      return;
    }
    const base = getPublicApiUrl().replace(/\/$/, "");
    if (!base) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      const qs = new URLSearchParams({
        q: trimmed,
        registry_key: registryKey,
        include_members: "true",
      });
      void apiFetchJson<DuplicateResponse>(
        `${base}/api/v1/cidoc/entity-clusters/suggest-duplicates/?${qs}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )
        .then((data) => {
          if (cancelled) return;
          setHints(data.results ?? []);
          setRecommendation(data.recommendation ?? "create_new");
        })
        .catch(() => {
          if (!cancelled) {
            setHints([]);
            setRecommendation("create_new");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [accessToken, disabled, registryKey, trimmed]);

  const top = hints[0];
  const editTarget = top?.canonical_member ?? top?.members?.[0];

  const editHref = useMemo(() => {
    if (!editTarget?.entity_id) return null;
    const rk = editTarget.registry_key ?? top?.registry_key ?? registryKey;
    const route = getContributePathForRegistryKey(registry, rk);
    if (!route) return null;
    return `${route}?id=${encodeURIComponent(String(editTarget.entity_id))}`;
  }, [editTarget, registry, registryKey, top?.registry_key]);

  const viewHref = useMemo(() => {
    if (!editTarget?.entity_id) return null;
    const rk = editTarget.registry_key ?? top?.registry_key ?? registryKey;
    return `/knowledge/${rk}/view/${encodeURIComponent(String(editTarget.entity_id))}`;
  }, [editTarget, registryKey, top?.registry_key]);

  if (disabled || trimmed.length < 3 || loading || !top) {
    return null;
  }

  const memberCount = top.member_count ?? top.members?.length ?? 0;

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        {recommendation === "edit_existing"
          ? "This may already exist on HeritageGraph"
          : "Similar record found"}
      </AlertTitle>
      <AlertDescription className="space-y-3 text-sm">
        <p>
          <span className="font-medium text-foreground">{top.canonical_label}</span>
          {memberCount > 0
            ? ` already has ${memberCount} curated record${memberCount === 1 ? "" : "s"} in the identity cluster.`
            : " matches your label."}{" "}
          Scientific best practice: <strong>enrich the canonical record</strong> instead of
          creating a duplicate submission.
        </p>
        {editTarget ? (
          <p className="text-muted-foreground">
            Canonical pick: {editTarget.display_title}
            {editTarget.completeness_score != null
              ? ` (completeness ${editTarget.completeness_score})`
              : ""}
            {editTarget.status ? ` · ${String(editTarget.status).replace(/_/g, " ")}` : ""}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {editHref ? (
            <Button asChild size="sm" variant="default">
              <Link href={editHref}>Edit existing record</Link>
            </Button>
          ) : null}
          {viewHref ? (
            <Button asChild size="sm" variant="outline">
              <Link href={viewHref}>View record</Link>
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          You can still submit a new contribution — it will link to the same identity and enter
          review for curator comparison.
        </p>
      </AlertDescription>
    </Alert>
  );
}
