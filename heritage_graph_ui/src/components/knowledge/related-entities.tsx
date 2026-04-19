"use client";

import type { ElementType } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import * as Lucide from "lucide-react";
import { toast } from "sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetchJson, apiUrl, getApiErrorMessage } from "@/lib/api-client";
import { useOntology } from "@/lib/ontology/OntologyProvider";
import { cn } from "@/lib/utils";

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

interface RelatedRow {
  id: string;
  domain_key: string;
  name: string;
  summary: string;
  display_type: string;
}

interface RelatedGroupResponse {
  domain_key: string;
  display_type: string;
  count: number;
  page: number;
  page_size: number;
  has_more: boolean;
  results: RelatedRow[];
}

interface RelatedApiResponse {
  domain: string;
  entity_id: string;
  page: number;
  page_size: number;
  group: string | null;
  total_related: number;
  groups: RelatedGroupResponse[];
}

function OntologyLucideIcon({
  iconName,
  className,
}: {
  iconName?: string;
  className?: string;
}) {
  if (!iconName) {
    return <Lucide.Link2 className={className} />;
  }
  const pascal = iconName
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  const Cmp = (Lucide as unknown as Record<string, ElementType<{ className?: string }>>)[pascal];
  if (Cmp && typeof Cmp === "function") {
    return <Cmp className={className} />;
  }
  return <Lucide.Link2 className={className} />;
}

interface RelatedEntitiesProps {
  domain: string;
  entityId: string;
  /** Tighter layout when shown inside the entity view sidebar (no outer card chrome). */
  embedded?: boolean;
  /** Shown when embedded and there are no related entities (e.g. link to contribution flow). */
  emptyCtaHref?: string;
  emptyCtaLabel?: string;
}

export function RelatedEntities({
  domain,
  entityId,
  embedded = false,
  emptyCtaHref,
  emptyCtaLabel,
}: RelatedEntitiesProps) {
  const { getOntologyClass } = useOntology();
  const { data: session } = useSession();
  const [groups, setGroups] = useState<RelatedGroupResponse[]>([]);
  const [totalRelated, setTotalRelated] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMoreKey, setLoadingMoreKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = (session as { accessToken?: string } | null)?.accessToken;
      const params = new URLSearchParams({
        domain,
        id: entityId,
        page: "1",
        page_size: "10",
      });
      const data = await apiFetchJson<RelatedApiResponse>(apiUrl(`/cidoc/related/?${params}`), {
        headers: token
          ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
          : { Accept: "application/json" },
      });
      setGroups(data.groups ?? []);
      setTotalRelated(data.total_related ?? 0);
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, "Could not load related entities.");
      setError(msg);
      toast.error(msg);
      setGroups([]);
      setTotalRelated(0);
    } finally {
      setLoading(false);
    }
  }, [domain, entityId, session]);

  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  const loadMore = async (g: RelatedGroupResponse) => {
    const nextPage = g.page + 1;
    setLoadingMoreKey(g.domain_key);
    try {
      const token = (session as { accessToken?: string } | null)?.accessToken;
      const params = new URLSearchParams({
        domain,
        id: entityId,
        page: String(nextPage),
        page_size: String(g.page_size),
        group: g.domain_key,
      });
      const data = await apiFetchJson<RelatedApiResponse>(apiUrl(`/cidoc/related/?${params}`), {
        headers: token
          ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
          : { Accept: "application/json" },
      });
      const incoming = data.groups?.[0];
      if (!incoming) return;
      setGroups((prev) =>
        prev.map((row) =>
          row.domain_key === g.domain_key
            ? {
                ...incoming,
                results: [...row.results, ...incoming.results],
              }
            : row
        )
      );
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Could not load more."));
    } finally {
      setLoadingMoreKey(null);
    }
  };

  if (loading) {
    return (
      <div
        className={cn(
          "text-center text-muted-foreground text-sm",
          embedded ? "py-6 px-2" : "rounded-lg border bg-card p-8",
        )}
      >
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent" />
        <p className="mt-3">Loading related entities…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "text-center text-sm text-muted-foreground",
          embedded ? "py-4 px-1" : "rounded-lg border border-destructive/30 bg-card p-6",
        )}
      >
        {error}
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={() => void fetchInitial()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (totalRelated === 0 || groups.length === 0) {
    return (
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeInUp}
        className={cn(
          "text-center",
          embedded ? "py-4 px-2" : "rounded-lg border bg-card p-10",
        )}
      >
        <Lucide.Link2
          className={cn(
            "mx-auto mb-2 text-muted-foreground opacity-40",
            embedded ? "h-7 w-7" : "h-10 w-10 mb-3",
          )}
        />
        <p className="font-medium text-foreground text-sm">No related entities yet</p>
        <p
          className={cn(
            "text-muted-foreground mt-1 mx-auto",
            embedded ? "text-xs leading-relaxed" : "text-sm max-w-md",
          )}
        >
          Nothing links here yet. When other records reference this one, they will show up.
        </p>
        {embedded && emptyCtaHref ? (
          <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
            <Link href={emptyCtaHref}>{emptyCtaLabel ?? "Add links via contribute"}</Link>
          </Button>
        ) : null}
      </motion.div>
    );
  }

  const defaultOpen = groups.map((g) => g.domain_key);

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={staggerContainer}
      className={embedded ? "space-y-2" : "space-y-4"}
    >
      {!embedded ? (
        <p className="text-sm text-muted-foreground">
          {totalRelated} related entit{totalRelated === 1 ? "y" : "ies"} across {groups.length} type
          {groups.length === 1 ? "" : "s"}.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {totalRelated} linked entit{totalRelated === 1 ? "y" : "ies"}
        </p>
      )}

      <Accordion
        type="multiple"
        defaultValue={defaultOpen}
        className={cn(embedded ? "border-0 bg-transparent px-0" : "rounded-lg border bg-card px-2")}
      >
        {groups.map((g) => {
          const oc = getOntologyClass(g.domain_key);
          return (
            <AccordionItem key={g.domain_key} value={g.domain_key}>
              <AccordionTrigger className="hover:no-underline py-3 px-2">
                <span className="flex items-center gap-3 min-w-0">
                  <OntologyLucideIcon
                    iconName={oc?.icon}
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                  />
                  <span className="font-semibold truncate">{g.display_type}</span>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {g.count}
                  </Badge>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-2">
                <motion.ul className="space-y-1" variants={staggerContainer} initial="hidden" animate="show">
                  {g.results.map((row) => (
                    <motion.li key={`${row.domain_key}-${row.id}`} variants={fadeInUp}>
                      <Link
                        href={`/knowledge/${row.domain_key}/view/${row.id}`}
                        className={cn(
                          "flex flex-col gap-0.5 rounded-md border border-transparent px-3 py-2.5",
                          "hover:bg-muted/60 hover:border-border transition-colors text-left"
                        )}
                      >
                        <span className="font-medium text-sm leading-snug">{row.name}</span>
                        {row.summary ? (
                          <span className="text-xs text-muted-foreground line-clamp-2">{row.summary}</span>
                        ) : null}
                        <span className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] font-normal">
                            {oc?.label ?? row.display_type}
                          </Badge>
                        </span>
                      </Link>
                    </motion.li>
                  ))}
                </motion.ul>
                {g.has_more ? (
                  <div className="pt-2 px-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={loadingMoreKey === g.domain_key}
                      onClick={() => void loadMore(g)}
                    >
                      {loadingMoreKey === g.domain_key ? "Loading…" : "Load more"}
                    </Button>
                  </div>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </motion.div>
  );
}
