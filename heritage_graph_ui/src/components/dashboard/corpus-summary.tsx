'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { IconAlertTriangle, IconExternalLink } from '@tabler/icons-react';

import { apiFetchJson, getApiErrorMessage } from '@/lib/api-client';
import { cidocApiPath } from '@/lib/api-paths';
import { getPublicApiUrl } from '@/lib/api-base';
import { surfaceCard } from '@/lib/design';
import { publicSparqlEndpoint, sparqlForPublicSubgraph } from '@/lib/provenance';
import { cn } from '@/lib/utils';
import { TypeHistogramChart, type TypeCount } from './type-histogram-chart';

/**
 * Live state of the knowledge graph, read from the public `kg/stats/` endpoint.
 *
 * This is the first thing on the dashboard because it is the one thing a
 * visitor — including a reviewer without an account — can verify independently
 * by querying the SPARQL endpoint. Nothing here is estimated or cached: if the
 * store is unreachable the component says so rather than showing stale figures.
 */

/**
 * One row of the `?type (COUNT(?s) AS ?count)` histogram.
 *
 * The endpoint returns SPARQL result rows, not a keyed object, and the query
 * carries `LIMIT 200` — so the row count saturates rather than growing without
 * bound once the ontology is that wide.
 */
interface TypeHistogramRow {
  type?: string;
  count?: string;
}

/** Matches the `LIMIT` in `entity_types_query`. */
const TYPE_HISTOGRAM_LIMIT = 200;

interface KgStats {
  rdf_sync_enabled: boolean;
  store_healthy: boolean;
  total_triples: number;
  public_graph_triples: number;
  schema_graph_triples: number;
  source: string | null;
  type_histogram: TypeHistogramRow[] | null;
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className={cn(surfaceCard, 'p-4')}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  );
}

export function CorpusSummary() {
  const t = useTranslations('dashboard.corpus');
  const [stats, setStats] = useState<KgStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await apiFetchJson<KgStats>(cidocApiPath('kg', 'stats'), {
          headers: { Accept: 'application/json' },
        });
        if (!cancelled) setStats(data);
      } catch (err: unknown) {
        if (!cancelled) setError(getApiErrorMessage(err, t('unavailable')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(surfaceCard, 'p-4')}>
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-7 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-3 w-full animate-pulse rounded bg-muted" />
          </div>
        ))}
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={cn(surfaceCard, 'p-4')} role="alert">
        <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <IconAlertTriangle className="size-4" aria-hidden />
          {t('unavailable')}
        </p>
        {error ? (
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        ) : null}
      </div>
    );
  }

  const distinctTypes = stats.type_histogram?.length ?? null;
  const typesSaturated = distinctTypes === TYPE_HISTOGRAM_LIMIT;

  const format = (n: number) => n.toLocaleString();

  // Rows arrive as SPARQL bindings with string counts; drop anything without a
  // usable type or a numeric count rather than charting a NaN.
  const histogramRows: TypeCount[] | null =
    stats.type_histogram === null ? null : (
      stats.type_histogram
        .map((r) => ({ type: r.type ?? '', count: Number(r.count ?? NaN) }))
        .filter((r) => r.type !== '' && Number.isFinite(r.count) && r.count > 0)
    );

  // Prefilled so the link resolves to results. The proxy rejects a bare GET
  // with 400 ("query parameter is required"), which would make the one link
  // inviting independent verification the first thing to break.
  const apiBase = getPublicApiUrl();
  const sparqlHref = apiBase
    ? `${publicSparqlEndpoint(apiBase)}?query=${encodeURIComponent(
        sparqlForPublicSubgraph(),
      )}`
    : null;

  return (
    <div className="space-y-4" aria-live="polite" aria-busy={false}>
      {!stats.store_healthy ? (
        <div
          className={cn(surfaceCard, 'border-destructive/40 p-4')}
          role="alert"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <IconAlertTriangle className="size-4" aria-hidden />
            {t('storeUnhealthy')}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure
          label={t('publicTriples.label')}
          value={format(stats.public_graph_triples)}
          hint={t('publicTriples.hint')}
        />
        <Figure
          label={t('totalTriples.label')}
          value={format(stats.total_triples)}
          hint={t('totalTriples.hint')}
        />
        <Figure
          label={t('schemaTriples.label')}
          value={format(stats.schema_graph_triples)}
          hint={t('schemaTriples.hint')}
        />
        <Figure
          label={t('distinctTypes.label')}
          value={
            distinctTypes === null ? t('notAvailable')
            : typesSaturated ? `${format(distinctTypes)}+`
            : format(distinctTypes)
          }
          hint={typesSaturated ? t('distinctTypes.hintCapped') : t('distinctTypes.hint')}
        />
      </div>

      {/* The histogram was already being fetched; only its length was used.
          Bar length is the encoding and nothing is carried by hue, so it reads
          in greyscale and under any colour vision deficiency. */}
      <TypeHistogramChart rows={histogramRows} />

      {/* One sentence, one message. Splitting it into fragments around the links
          produced missing word spaces in Nepali, where the particles fall on the
          other side of the link text. */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t.rich('verify', {
          methodsLink: (chunks) => (
            <Link
              href="/methods"
              className="font-medium text-primary underline underline-offset-2 hover:no-underline"
            >
              {chunks}
            </Link>
          ),
          sparqlLink: (chunks) =>
            sparqlHref ?
              <a
                href={sparqlHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:no-underline"
              >
                {chunks}
                <IconExternalLink className="size-3" aria-hidden />
              </a>
            : <span>{chunks}</span>,
        })}
      </p>
    </div>
  );
}
