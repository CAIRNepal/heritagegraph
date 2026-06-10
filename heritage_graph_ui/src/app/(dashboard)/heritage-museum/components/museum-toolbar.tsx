'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  IconDatabase,
  IconGraph,
  IconMapPin,
  IconCube,
  IconLoader2,
  IconInfoCircle,
  IconDownload,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { glassCard } from '@/lib/design';
import type { MuseumDatasetMeta } from '@/lib/heritage-museum/museum-rigor';
import { cn } from '@/lib/utils';

import { MuseumMethodsPanel } from './MuseumMethodsPanel';

export type MuseumViewMode = '2d' | 'xr' | 'map';
export type MuseumDataSource = 'demo' | 'live';

export interface MuseumCorpusProvenance {
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
  onToggleDataSource: () => void;
  nodeCount: number;
  linkCount: number;
  showStats: boolean;
  provenanceText?: string | null;
  provenance?: MuseumCorpusProvenance | null;
  liveApiBase?: string | null;
  datasetMeta?: MuseumDatasetMeta | null;
  onExportJson?: () => void;
}

export function MuseumToolbar({
  viewMode,
  onViewModeChange,
  dataSource,
  liveLoading,
  onToggleDataSource,
  nodeCount,
  linkCount,
  showStats,
  provenanceText,
  provenance,
  liveApiBase,
  datasetMeta,
  onExportJson,
}: MuseumToolbarProps) {
  const t = useTranslations('heritageMuseum');
  const [citationCopied, setCitationCopied] = useState(false);

  return (
    <div
      className={cn(
        glassCard,
        'flex-shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border rounded-none shadow-none',
      )}
      role="toolbar"
      aria-label={t('filters.regionLabel')}
    >
      <p className="hidden sm:block text-xs text-muted-foreground max-w-xs leading-snug mr-1">
        {t('subtitle')}
      </p>

      {dataSource === 'live' && datasetMeta ? (
        <Badge variant="outline" className="hidden md:inline-flex text-[10px] font-mono gap-1">
          v{datasetMeta.release} · {t('methods.scopeReviewed')}
        </Badge>
      ) : null}

      {provenanceText ? (
        <p className="hidden lg:block text-[11px] text-muted-foreground/90 max-w-[32rem] truncate">
          {provenanceText}
        </p>
      ) : null}

      <div className="flex-1 min-w-[1rem]" />

      {onExportJson && dataSource === 'live' ? (
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
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2.5 text-xs gap-1.5"
            aria-label={t('methods.title')}
          >
            <IconInfoCircle className="w-4 h-4" aria-hidden />
            <span className="hidden sm:inline">{t('timeline.methodsButton')}</span>
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

      {showStats && (
        <span className="hidden md:inline text-xs text-muted-foreground tabular-nums">
          {t('stats', { nodes: nodeCount, links: linkCount })}
        </span>
      )}

      <Button
        type="button"
        size="sm"
        variant={dataSource === 'live' ? 'default' : 'outline'}
        disabled={liveLoading}
        onClick={onToggleDataSource}
        className="hidden sm:inline-flex gap-1.5 text-xs h-8"
      >
        {liveLoading ? (
          <IconLoader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        ) : (
          <IconDatabase className="w-3.5 h-3.5" aria-hidden />
        )}
        {liveLoading
          ? t('dataSource.loading')
          : dataSource === 'live'
            ? t('dataSource.live')
            : t('dataSource.demo')}
      </Button>

      <Tabs
        value={viewMode}
        onValueChange={(v) => onViewModeChange(v as MuseumViewMode)}
        className="shrink-0"
      >
        <TabsList className="h-8">
          <TabsTrigger value="2d" className="text-xs gap-1 px-2.5">
            <IconGraph className="w-3.5 h-3.5" aria-hidden />
            {t('views.graph')}
          </TabsTrigger>
          <TabsTrigger value="map" className="text-xs gap-1 px-2.5">
            <IconMapPin className="w-3.5 h-3.5" aria-hidden />
            {t('views.map')}
          </TabsTrigger>
          <TabsTrigger value="xr" className="text-xs gap-1 px-2.5">
            <IconCube className="w-3.5 h-3.5" aria-hidden />
            {t('views.xr')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="hidden lg:flex items-center gap-1 flex-wrap">
        {(['cidoc', 'hg', 'prov', 'jsonld'] as const).map((key) => (
          <Badge key={key} variant="secondary" className="text-[10px] font-mono px-2 py-0">
            {t(`ontologyBadges.${key}`)}
          </Badge>
        ))}
      </div>
    </div>
  );
}
