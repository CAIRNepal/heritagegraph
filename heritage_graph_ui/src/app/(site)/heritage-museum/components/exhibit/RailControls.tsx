'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconDownload, IconInfoCircle, IconLoader2 } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DatasetMeta } from '@/lib/provenance';

import { MuseumMethodsPanel } from '../MuseumMethodsPanel';
import type { MuseumCorpusProvenance, MuseumDataSource } from '../museum-types';

interface RailControlsProps {
  dataSource: MuseumDataSource;
  demoCount: number;
  liveLoading: boolean;
  onSwitchSource: () => void;
  provenance: MuseumCorpusProvenance | null;
  liveApiBase: string | null;
  datasetMeta: DatasetMeta | null;
  onExportJson?: () => void;
}

/** Which collection this is, how to switch, and where its sources are. */
export function RailControls({
  dataSource,
  demoCount,
  liveLoading,
  onSwitchSource,
  provenance,
  liveApiBase,
  datasetMeta,
  onExportJson,
}: RailControlsProps) {
  const t = useTranslations('heritageMuseum');
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-2 border border-story-rule px-3 py-2.5 text-xs">
      {/* Which collection is showing is the first thing a reader must know:
          a two-way switch, never a sentence with a link hidden in it. */}
      <div role="radiogroup" aria-label={t('dataSource.label')} className="grid grid-cols-2 border border-story-rule text-[12.5px] font-semibold">
        {(['live', 'demo'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={dataSource === s}
            disabled={liveLoading}
            onClick={() => dataSource !== s && onSwitchSource()}
            className={cn(
              'cursor-pointer px-2 py-1.5 first:border-r first:border-story-rule disabled:opacity-60',
              dataSource === s ? 'bg-story-ink text-story-paper' : 'hover:bg-story-panel',
            )}
          >
            {s === 'live' ? t('dataSource.live') : t('dataSource.demo')}
          </button>
        ))}
      </div>
      <p className="leading-snug text-story-ink-soft">
        {dataSource === 'demo' ? t('demoBanner', { count: demoCount }) : t('exhibit.liveSourceLine')}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-story-ink-soft">
        {liveLoading ? (
          <span className="inline-flex items-center gap-1" role="status">
            <IconLoader2 className="size-3.5 motion-safe:animate-spin" aria-hidden />
            {t('dataSource.loading')}
          </span>
        ) : null}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="link" className="h-auto gap-1 p-0 text-xs text-story-ink-soft hover:text-story-ink" aria-label={t('methods.title')}>
              <IconInfoCircle className="size-3.5" aria-hidden />
              {t('methods.buttonLabel')}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" sideOffset={8} className="w-[min(34rem,92vw)] p-0">
            <MuseumMethodsPanel
              dataSource={dataSource}
              liveApiBase={liveApiBase}
              provenance={provenance}
              datasetMeta={datasetMeta}
              onCopyCitation={() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
            />
            {copied ? <p className="px-4 pb-3 text-[11px] text-primary">{t('methods.citationCopied')}</p> : null}
          </PopoverContent>
        </Popover>
        {onExportJson ? (
          <Button type="button" variant="link" className="h-auto gap-1 p-0 text-xs text-story-ink-soft hover:text-story-ink" onClick={onExportJson} aria-label={t('export.jsonAria')}>
            <IconDownload className="size-3.5" aria-hidden />
            {t('export.json')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
