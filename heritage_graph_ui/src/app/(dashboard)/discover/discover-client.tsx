'use client';

/**
 * Discover hub — a professional, engaging entry point into the curated knowledge
 * graph: a featured entity, a "surprise me" jump, and a grid of curated entities.
 * Reuses the existing /kg/graph (reviewed scope) projection — no new endpoint.
 * Uses semantic theme tokens only (no hardcoded colors).
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { IconSparkles, IconArrowRight, IconBuildingMonument, IconWorld } from '@tabler/icons-react';

import { getPublicApiUrl } from '@/lib/api-base';
import { fetchKgGraph, rdfTypeToNodeType, type KgGraphNode } from '@/lib/kg-graph';
import { NODE_TYPE_CONFIG } from '@/lib/ontology/__generated__/heritage-viz-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type Item = { href: string; label: string; type: string; comment: string | null };

/** Curated resource IRI → /knowledge/<domain>/view/<pk>; null if not parseable. */
function toDetailHref(iri: string): string | null {
  const m = iri.match(/\/resource\/([^/]+)\/([^/]+)\/?$/);
  if (!m) return null;
  return `/knowledge/${m[1]}/view/${m[2]}`;
}

function toItem(n: KgGraphNode): Item | null {
  const href = toDetailHref(n.id);
  if (!href) return null;
  const nt = rdfTypeToNodeType(n.types);
  const typeLabel = (nt && NODE_TYPE_CONFIG[nt]?.label) || 'Heritage';
  return { href, label: n.label, type: typeLabel, comment: n.comment };
}

export function DiscoverClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const base = getPublicApiUrl();
        if (!base) return;
        const token = (session as { accessToken?: string } | null)?.accessToken;
        const resp = await fetchKgGraph(base, token, { scope: 'reviewed', includeLux: 'none' });
        const mapped = resp.nodes
          .filter((n) => n.id.includes('/resource/'))
          .map(toItem)
          .filter((x): x is Item => x !== null);
        if (alive) setItems(mapped);
      } catch {
        /* leave empty */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session]);

  const featured = items[0];
  const surprise = React.useCallback(() => {
    if (!items.length) return;
    router.push(items[Math.floor(Math.random() * items.length)].href);
  }, [items, router]);

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border bg-primary text-primary-foreground p-8 md:p-10">
        <div className="relative z-10 max-w-2xl">
          <Badge variant="secondary" className="mb-3 gap-1">
            <IconSparkles className="h-3.5 w-3.5" /> Discover
          </Badge>
          <h1 className="font-serif text-3xl md:text-4xl font-semibold leading-tight">
            Explore Nepal&rsquo;s living heritage
          </h1>
          <p className="mt-3 text-primary-foreground/80 text-base md:text-lg">
            Wander the curated knowledge graph — monuments, deities, festivals, guthis and the
            people and places that connect them.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={surprise} disabled={!items.length}>
              <IconSparkles className="mr-2 h-4 w-4" /> Surprise me
            </Button>
            <Link href="/heritage-museum">
              <Button variant="secondary"><IconBuildingMonument className="mr-2 h-4 w-4" /> Museum</Button>
            </Link>
            <Link href="/atlas">
              <Button variant="secondary"><IconWorld className="mr-2 h-4 w-4" /> Atlas</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Featured
          </h2>
          <Link href={featured.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex-1">
                  <Badge variant="outline" className="mb-1">{featured.type}</Badge>
                  <p className="text-xl font-semibold">{featured.label}</p>
                  {featured.comment && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{featured.comment}</p>
                  )}
                </div>
                <IconArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </section>
      )}

      {/* Grid */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          From the knowledge graph
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">
            No curated entities to show yet. <Link href="/contribute" className="text-primary underline">Contribute one →</Link>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.slice(1, 25).map((it) => (
              <Link key={it.href} href={it.href}>
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardContent className="p-4">
                    <Badge variant="outline" className="mb-2">{it.type}</Badge>
                    <p className="font-medium leading-tight">{it.label}</p>
                    {it.comment && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{it.comment}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
