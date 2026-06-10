'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  HERITAGEGRAPH_CITATION,
  HERITAGEGRAPH_DOI,
  HERITAGEGRAPH_RELEASE,
  type MuseumDatasetMeta,
  publicSparqlEndpoint,
  sparqlForPublicSubgraph,
  copyToClipboard,
} from '@/lib/heritage-museum/museum-rigor';
import type { MuseumCorpusProvenance, MuseumDataSource } from './museum-toolbar';

interface MuseumMethodsPanelProps {
  dataSource: MuseumDataSource;
  liveApiBase?: string | null;
  provenance?: MuseumCorpusProvenance | null;
  datasetMeta?: MuseumDatasetMeta | null;
  onCopyCitation?: () => void;
}

export function MuseumMethodsPanel({
  dataSource,
  liveApiBase,
  provenance,
  datasetMeta,
  onCopyCitation,
}: MuseumMethodsPanelProps) {
  const t = useTranslations('heritageMuseum.methods');

  const handleCopyCitation = async () => {
    const ok = await copyToClipboard(HERITAGEGRAPH_CITATION);
    if (ok) onCopyCitation?.();
  };

  const handleCopySparql = async () => {
    const q = sparqlForPublicSubgraph(datasetMeta?.graphUri);
    await copyToClipboard(q);
  };

  const sparqlUrl =
    liveApiBase && dataSource === 'live' ? publicSparqlEndpoint(liveApiBase) : null;

  return (
    <div className="p-4 space-y-3 max-h-[min(70vh,32rem)] overflow-y-auto">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{t('title')}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{t('intro')}</p>
      </div>

      {/* Dataset identity */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">{t('datasetIdentity')}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">{t('release')}</dt>
          <dd className="font-mono text-foreground">{HERITAGEGRAPH_RELEASE}</dd>
          <dt className="text-muted-foreground">{t('scope')}</dt>
          <dd className="font-mono text-foreground">
            {datasetMeta?.scope ?? (dataSource === 'live' ? 'reviewed' : 'demo')}
          </dd>
          <dt className="text-muted-foreground">{t('license')}</dt>
          <dd className="text-foreground">{t('licenseValue')}</dd>
          <dt className="text-muted-foreground">DOI</dt>
          <dd className="font-mono text-foreground break-all">{HERITAGEGRAPH_DOI}</dd>
          {dataSource === 'live' && datasetMeta ? (
            <>
              <dt className="text-muted-foreground">{t('graphPartition')}</dt>
              <dd className="font-mono text-[10px] text-foreground break-all">
                {datasetMeta.graphUri}
              </dd>
              <dt className="text-muted-foreground">{t('counts')}</dt>
              <dd className="text-foreground tabular-nums">
                {datasetMeta.nodeCount} {t('nodes')} · {datasetMeta.edgeCount} {t('edges')}
                {datasetMeta.edgesWithProvenance != null
                  ? ` · ${datasetMeta.edgesWithProvenance} ${t('withProvenance')}`
                  : ''}
              </dd>
              <dt className="text-muted-foreground">{t('fetched')}</dt>
              <dd className="font-mono text-[10px] text-muted-foreground">
                {datasetMeta.fetchedAt}
              </dd>
            </>
          ) : null}
        </dl>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs w-full"
          onClick={() => void handleCopyCitation()}
        >
          {t('copyCitation')}
        </Button>
      </div>

      {/* Live pipeline */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-foreground">{t('livePipeline')}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{t('livePipelineBody')}</p>
        <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
          <li>{t('liveStep1')}</li>
          <li>{t('liveStep2')}</li>
          <li>{t('liveStep3')}</li>
          <li>{t('liveStep4')}</li>
        </ul>
      </div>

      {/* Demo */}
      {dataSource === 'demo' ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">{t('demoWarningTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('demoWarningBody')}</p>
          {provenance?.retrieved ? (
            <p className="text-[11px] text-muted-foreground font-mono">
              {t('demoFrozen', { date: provenance.retrieved })}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Reproducibility */}
      {dataSource === 'live' && sparqlUrl ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">{t('reproducibility')}</p>
          <p className="text-xs text-muted-foreground">{t('sparqlNote')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => void handleCopySparql()}
            >
              {t('copySparql')}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" asChild>
              <a href={sparqlUrl} target="_blank" rel="noopener noreferrer">
                {t('openSparql')}
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
        <Link href="/methods">{t('fullMethodsPage')}</Link>
      </Button>
    </div>
  );
}
