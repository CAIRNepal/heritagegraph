'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  IconGraph,
  IconMapPin,
  IconBook,
  IconLoader2,
  IconInfoCircle,
  IconDownload,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { glassCard } from '@/lib/design';
import type { DatasetMeta } from '@/lib/provenance';
import { cn } from '@/lib/utils';

import { MuseumMethodsPanel } from './MuseumMethodsPanel';

export type MuseumViewMode = '2d' | 'xr' | 'map';
export type MuseumDataSource = 'demo' | 'live';

export interface MuseumCorpusProvenance {
  textAuthorship?: 'unrecorded' | 'sourced';
  textAuthorshipNote?: string;
  generatedBy?: string;
  retrieved?: string;
  imageSource?: string;
  note?: string;
}

interface MuseumToolbarProps {
  viewMode: MuseumViewMode;
  onViewModeChange: (mode: MuseumViewMode) => void;
  dataSource: MuseumDataSource;
  liveLoading: boolean;
  /** No longer read here — the disclosure bar owns the switch. Kept so
   *  the caller keeps one place to pass it if the control returns. */
  onToggleDataSource?: () => void;
  nodeCount: number;
  linkCount: number;
  showStats: boolean;
  provenance?: MuseumCorpusProvenance | null;
  liveApiBase?: string | null;
  datasetMeta?: DatasetMeta | null;
  onExportJson?: () => void;
}

/**
 * Slim header: what this is, Sources, corpus switch, and Stories → Map → Connections.
 * Dataset identity and standards live in the Sources popover, not on this bar.
 */
export function MuseumToolbar({
  viewMode,
  onViewModeChange,
  dataSource,
  liveLoading,
  nodeCount,
  linkCount,
  showStats,
  provenance,
  liveApiBase,
  datasetMeta,
  onExportJson,
}: MuseumToolbarProps) {
  const t = useTranslations('heritageMuseum');
  const [citationCopied, setCitationCopied] = useState(false);

  return (
    /* Inline, not a band. This was a full-width bar of its own between the
       title and the search bar; it sits in the masthead row now, so the page
       opens with two bands instead of five. */
    <div
      className="flex flex-wrap items-center gap-2"
      role="toolbar"
      aria-label={t('views.regionLabel')}
    >
      {showStats && viewMode !== 'xr' ? (
        <span className="hidden md:inline text-xs text-muted-foreground tabular-nums">
          {t('stats', { nodes: nodeCount, links: linkCount })}
        </span>
      ) : null}

      {onExportJson && dataSource === 'live' && viewMode === '2d' ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 px-2.5 text-xs gap-1.5"
          onClick={onExportJson}
          aria-label={t('export.jsonAria')}
        >
          <IconDownload className="w-4 h-4" aria-hidden />
          <span className="hidden sm:inline">{t('export.json')}</span>
        </Button>
      ) : null}

      <Popover>
        <PopoverTrigger asChild>
          {/* Three registers, three shapes: the global bar is navigation, the
              view switch below is a segmented control, and contextual actions
              like this one are text links. As a ghost button beside the
              segmented group it read as a fourth view. */}
          <Button
            type="button"
            variant="link"
            className="h-8 gap-1.5 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            aria-label={t('methods.title')}
          >
            <IconInfoCircle className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{t('methods.buttonLabel')}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8} className="w-[min(34rem,92vw)] p-0">
          <MuseumMethodsPanel
            dataSource={dataSource}
            liveApiBase={liveApiBase}
            provenance={provenance}
            datasetMeta={datasetMeta}
            onCopyCitation={() => {
              setCitationCopied(true);
              window.setTimeout(() => setCitationCopied(false), 2000);
            }}
          />
          {citationCopied ? (
            <p className="px-4 pb-3 text-[11px] text-primary">{t('methods.citationCopied')}</p>
          ) : null}
        </PopoverContent>
      </Popover>

      {/* The "Demo corpus" chip used to sit here. The disclosure bar above the
          title already says which corpus this is AND carries the switch-to-live
          action, so the chip was the third of three adjacent elements saying one
          thing. Only the loading state still needs surfacing. */}
      {liveLoading ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <IconLoader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {t('dataSource.loading')}
        </span>
      ) : null}

      <Tabs
        value={viewMode}
        onValueChange={(v) => onViewModeChange(v as MuseumViewMode)}
        className="shrink-0"
      >
        <TabsList className="h-8">
          <TabsTrigger value="xr" className="text-xs gap-1 px-2.5">
            <IconBook className="w-3.5 h-3.5" aria-hidden />
            {t('views.xr')}
          </TabsTrigger>
          <TabsTrigger value="map" className="text-xs gap-1 px-2.5">
            <IconMapPin className="w-3.5 h-3.5" aria-hidden />
            {t('views.map')}
          </TabsTrigger>
          <TabsTrigger value="2d" className="text-xs gap-1 px-2.5">
            <IconGraph className="w-3.5 h-3.5" aria-hidden />
            {t('views.graph')}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
