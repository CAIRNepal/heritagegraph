"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Pencil, Link2, Eye, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { glassCard } from "@/lib/design";
import { getPublicApiUrl } from "@/lib/api-base";
import {
  contributeEditHref,
  flattenUniversalSearch,
  knowledgeViewHref,
  relationshipFromHref,
  type UniversalSearchHit,
} from "@/lib/cidoc-universal-search";

const DOMAIN_LABEL: Record<string, string> = {
  person: "Person",
  location: "Place",
  event: "Event",
  tradition: "Tradition",
  deity: "Deity",
  guthi: "Guthi",
  structure: "Structure",
  ritual: "Ritual",
  festival: "Festival",
  monument: "Monument",
};

function ImproveExistingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const initialQ = searchParams.get("q")?.trim() ?? "";

  const [query, setQuery] = useState(initialQ);
  const [hits, setHits] = useState<UniversalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (q.length < 2) {
        setHits([]);
        setSearched(false);
        setError(null);
        return;
      }
      const base = getPublicApiUrl().replace(/\/$/, "");
      if (!base) {
        setError("API is not configured.");
        return;
      }
      setLoading(true);
      setError(null);
      setSearched(true);
      try {
        const token = (session as { accessToken?: string } | null)?.accessToken;
        const res = await fetch(
          `${base}/api/v1/cidoc/search/?q=${encodeURIComponent(q)}`,
          {
            headers: {
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );
        if (!res.ok) {
          setError("Search failed. Try again in a moment.");
          setHits([]);
          return;
        }
        const data = (await res.json()) as Record<
          string,
          Array<Record<string, unknown>>
        >;
        setHits(flattenUniversalSearch(data).slice(0, 40));
      } catch {
        setError("Could not reach search. Check your connection and try again.");
        setHits([]);
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearched(false);
      return;
    }
    const t = window.setTimeout(() => {
      void runSearch(q);
      router.replace(`/contribute/improve?q=${encodeURIComponent(q)}`, {
        scroll: false,
      });
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, runSearch, router]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 lg:px-6">
      <div>
        <button
          type="button"
          onClick={() => router.push("/contribute")}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to contribute
        </button>
        <h1 className="text-2xl font-bold tracking-tight">
          Improve something already here
        </h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Search for a temple, person, deity, or other record that already exists.
          Then update it, or add a connection — don&apos;t create a duplicate.
        </p>
      </div>

      <div className={`relative ${glassCard} p-4`}>
        <Search className="pointer-events-none absolute left-7 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name… (e.g. Kasthamandap, Annapurna, Indra Jatra)"
          className="h-11 pl-9"
          autoFocus
          aria-label="Search existing heritage records"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Tip: type at least 2 characters. Results include places, people, events, and more.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Searching…
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && searched && !error && hits.length === 0 ? (
        <div className={`${glassCard} space-y-3 p-5`}>
          <p className="text-sm text-muted-foreground">
            No matching records found for &ldquo;{query.trim()}&rdquo;.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/contribute#browse-types">Add it as new instead</Link>
          </Button>
        </div>
      ) : null}

      {hits.length > 0 ? (
        <ul className="space-y-3">
          {hits.map((hit) => {
            const relHref = relationshipFromHref(hit.domain, hit.id);
            const typeLabel = DOMAIN_LABEL[hit.domain] ?? hit.domain;
            return (
              <li key={`${hit.domain}-${hit.id}`} className={`${glassCard} p-4`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-foreground">
                        {hit.label}
                      </h2>
                      <Badge variant="secondary" className="text-[10px]">
                        {typeLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Already in the knowledge base · #{hit.id}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={contributeEditHref(hit.domain, hit.id)}>
                      <Pencil className="mr-1.5 size-3.5" aria-hidden />
                      Update this record
                    </Link>
                  </Button>
                  {relHref ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={relHref}>
                        <Link2 className="mr-1.5 size-3.5" aria-hidden />
                        Add a connection
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="ghost">
                    <Link href={knowledgeViewHref(hit.domain, hit.id)}>
                      <Eye className="mr-1.5 size-3.5" aria-hidden />
                      View
                    </Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default function ImproveExistingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <ImproveExistingInner />
    </Suspense>
  );
}
