"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { apiFetchJson } from "@/lib/api-client";
import { getPublicApiUrl } from "@/lib/api-base";
import { culturalEntityKnowledgePath } from "@/lib/project-contribute";

interface ClusterHint {
  id: string;
  canonical_label: string;
  type_scope?: string;
}

interface SearchHit {
  id?: string | number;
  entity_id?: string;
  cultural_entity_id?: string;
  name?: string;
  title?: string;
}

export function ProjectPlatformMatchBadge({
  entityId,
  label,
  accessToken,
}: {
  entityId: string;
  label?: string;
  accessToken?: string;
}) {
  const [match, setMatch] = useState<{
    kind: "cluster" | "search";
    label: string;
    href: string;
  } | null>(null);

  useEffect(() => {
    if (!label?.trim() || label.trim().length < 3) return;
    const base = getPublicApiUrl().replace(/\/$/, "");
    if (!base) return;

    let cancelled = false;

    void (async () => {
      try {
        const headers: Record<string, string> = {};
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

        const dupRes = await apiFetchJson<{ results?: ClusterHint[] }>(
          `${base}/cidoc/entity-clusters/suggest-duplicates/?q=${encodeURIComponent(label.trim())}`,
          { headers }
        );
        const top = (dupRes.results ?? [])[0];
        if (top?.canonical_label && !cancelled) {
          setMatch({
            kind: "cluster",
            label: top.canonical_label,
            href: `/contribute/entity-proposal?q=${encodeURIComponent(top.canonical_label)}`,
          });
          return;
        }

        const search = await apiFetchJson<{ results?: SearchHit[] }>(
          `${base}/cidoc/search/?q=${encodeURIComponent(label.trim())}`,
          { headers }
        );
        const hit = (search.results ?? []).find((r) => {
          const rid = r.cultural_entity_id ?? r.entity_id ?? r.id;
          return rid != null && String(rid) !== entityId;
        });
        if (hit && !cancelled) {
          const rid = String(hit.cultural_entity_id ?? hit.entity_id ?? hit.id);
          setMatch({
            kind: "search",
            label: hit.name || hit.title || "Similar on platform",
            href: culturalEntityKnowledgePath(rid),
          });
        }
      } catch {
        /* optional enrichment */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [label, entityId, accessToken]);

  if (!match) return null;

  return (
    <Badge variant="secondary" className="text-[10px] font-normal" asChild>
      <Link href={match.href} title={match.label}>
        {match.kind === "cluster" ? "Possible platform match" : "On platform"}
      </Link>
    </Badge>
  );
}
