'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react';
import { getApiBaseUrl, appPath } from '@/lib/config';
import { apiFetch, getApiErrorMessage } from '@/lib/api-fetch';
import { PublicSiteHeader } from '@/components/public-site-header';
import { cn } from '@/lib/utils';

const VALID_RESOURCES = new Set([
  'persons',
  'monuments',
  'structures',
  'festivals',
  'deities',
  'guthis',
  'rituals',
]);

/** Dashboard knowledge path segment (matches `heritage_graph_ui` routes). */
const RESOURCE_TO_DASHBOARD_DOMAIN: Record<string, string> = {
  persons: 'person',
  monuments: 'monument',
  structures: 'structure',
  festivals: 'festival',
  deities: 'deity',
  guthis: 'guthi',
  rituals: 'ritual',
};

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number' || typeof val === 'string') return String(val);
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

export default function PublicRecordViewPage() {
  const params = useParams();
  const resource = typeof params.resource === 'string' ? params.resource : '';
  const id = typeof params.id === 'string' ? params.id : '';

  const [record, setRecord] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const valid = VALID_RESOURCES.has(resource);

  useEffect(() => {
    if (!valid || !id) {
      setLoading(false);
      if (!valid) setError('Unknown record type.');
      else if (!id) setError('Missing record id.');
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    const url = `${getApiBaseUrl()}/cidoc/${resource}/${encodeURIComponent(id)}/`;
    apiFetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } })
      .then((res) => res.json() as Promise<Record<string, unknown>>)
      .then(setRecord)
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError(getApiErrorMessage(e, 'Could not load this record.'));
        setRecord(null);
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [resource, id, valid]);

  const title = useMemo(() => {
    if (!record) return 'Record';
    const n = record.name ?? record.title;
    if (typeof n === 'string' && n.trim()) return n.trim();
    return `${resource} #${id}`;
  }, [record, resource, id]);

  const culturalEntityId = record?.cultural_entity_id;
  const dashboardEntityUrl =
    typeof culturalEntityId === 'string' && culturalEntityId
      ? appPath(`/knowledge/entity/view/${culturalEntityId}`)
      : null;

  const dashSeg = RESOURCE_TO_DASHBOARD_DOMAIN[resource] ?? resource;
  const dashboardDirectUrl = appPath(`/knowledge/${dashSeg}/view/${id}`);

  const entries = useMemo(() => {
    if (!record) return [];
    return Object.entries(record).filter(([k]) => k !== 'cultural_entity_id' || record[k] != null);
  }, [record]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicSiteHeader variant="record" />

      <main className="mx-auto max-w-[1000px] px-4 py-8">
        {!valid ? (
          <p className="text-destructive">{error}</p>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
            Loading record…
          </div>
        ) : error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
            {error}
          </p>
        ) : record ? (
          <article className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-muted/30 px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {resource.replace(/-/g, ' ')}
              </p>
              <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-foreground sm:text-3xl">
                {title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {dashboardEntityUrl ? (
                  <a
                    href={dashboardEntityUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground',
                      'hover:opacity-90'
                    )}
                  >
                    Open in app (entity)
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <a
                  href={dashboardDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Open in app (CIDOC)
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <div className="p-5">
              <dl className="grid gap-4 sm:grid-cols-1">
                {entries.map(([key, val]) => (
                  <div key={key} className="border-b border-border/80 pb-3 last:border-0 last:pb-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {formatLabel(key)}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                      {formatValue(val)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </article>
        ) : null}

        <footer className="mt-12 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          <span>Data from HeritageGraph CIDOC API · </span>
          <code className="rounded bg-muted px-1">GET /cidoc/{resource}/{id}/</code>
        </footer>
      </main>
    </div>
  );
}
