'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

/**
 * Distribution of entity types in the public graph.
 *
 * The stats endpoint already returns this histogram — the dashboard previously
 * fetched it and used only `.length`, throwing the distribution away.
 *
 * FORM: the data's job is magnitude across identities, so it is a ranked
 * horizontal bar. Bar length is the encoding.
 *
 * COLOR: one series, therefore one hue (`--chart-1`) and no legend — the
 * heading names it. Nothing is encoded in hue at all, so the chart is fully
 * readable in greyscale and under any colour vision deficiency. Every row also
 * carries its label and count as text, so the chart doubles as its own table
 * view rather than needing a separate one.
 */

export interface TypeCount {
  /** Full RDF class IRI. */
  type: string;
  count: number;
}

/** Local name of an IRI — the part after the last `#` or `/`. */
function localName(iri: string): string {
  if (!iri) return '';
  const i = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  const raw = i >= 0 ? iri.slice(i + 1) : iri;
  // CIDOC classes are coded (`E53_Place`); show the readable half.
  const cidoc = /^E\d+[_-](.+)$/.exec(raw);
  return (cidoc ? cidoc[1] : raw).replace(/_/g, ' ');
}

const MAX_ROWS = 8;

export function TypeHistogramChart({
  rows,
  className,
}: {
  rows: TypeCount[] | null;
  className?: string;
}) {
  const t = useTranslations('dashboard.corpus');

  // Real empty state. An empty histogram is a fact about the graph, not a
  // loading glitch, and it must not render as an axis with nothing on it.
  if (!rows || rows.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-32 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center',
          className,
        )}
      >
        <p className="max-w-[36ch] text-sm text-muted-foreground">{t('histogramEmpty')}</p>
      </div>
    );
  }

  const ranked = [...rows].sort((a, b) => b.count - a.count);
  const shown = ranked.slice(0, MAX_ROWS);
  const hidden = ranked.length - shown.length;

  // One shared scale across every bar. Scaling each bar to its own max is the
  // classic way to make a bar chart lie.
  const max = Math.max(...shown.map((r) => r.count), 1);
  const total = ranked.reduce((sum, r) => sum + r.count, 0);

  return (
    <figure className={cn('rounded-xl border border-border bg-card p-4 sm:p-5', className)}>
      <figcaption className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">{t('histogramTitle')}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t('histogramSubtitle', { total: total.toLocaleString() })}
        </p>
      </figcaption>

      <ul className="flex flex-col gap-2.5">
        {shown.map((row) => {
          const pct = (row.count / max) * 100;
          const share = total > 0 ? (row.count / total) * 100 : 0;
          const name = localName(row.type);
          return (
            <li key={row.type} className="group grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3">
              <span className="truncate text-xs text-foreground" title={row.type}>
                {name}
              </span>
              {/* Track is recessive; the bar is the only saturated thing here. */}
              <span className="relative block h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-chart-1 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${Math.max(pct, 1.5)}%` }}
                />
              </span>
              <span
                className="min-w-[3.5rem] text-right font-mono text-xs tabular-nums text-muted-foreground"
                title={t('histogramShare', { share: share.toFixed(1) })}
              >
                {row.count.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>

      {hidden > 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{t('histogramMore', { count: hidden })}</p>
      ) : null}
    </figure>
  );
}
