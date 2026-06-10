'use client';

import {
  IconAperture,
  IconFocus2,
  IconHelp,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconMaximize,
  IconMinimize,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { atlasSound } from '@/lib/atlas-sound';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { FxControls } from './fx-controls';
import { SpotlightControls } from './spotlight-controls';
import type { AtlasFxPresetId } from '../lib/atlas-fx-presets';
import { useAtlasStore } from '../hooks/use-atlas-store';

const FX_BADGE: Record<AtlasFxPresetId, string> = {
  normal: 'NORM',
  crt: 'CRT',
  nvg: 'NVG',
  flir: 'FLIR',
  anime: 'ANI',
  noir: 'NOIR',
  pixel: 'PIX',
};

interface CommandBarProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function CommandBar({ isFullscreen = false, onToggleFullscreen }: CommandBarProps) {
  const t = useTranslations('Atlas');

  const focusedView = useAtlasStore((s) => s.focusedView);
  const getFilteredEntities = useAtlasStore((s) => s.getFilteredEntities);
  const entities = useAtlasStore((s) => s.entities);
  const reliabilityFloor = useAtlasStore((s) => s.reliabilityFloor);
  const confidenceFloor = useAtlasStore((s) => s.confidenceFloor);
  const muted = useAtlasStore((s) => s.muted);
  const panelOpen = useAtlasStore((s) => s.panelOpen);
  const fxPreset = useAtlasStore((s) => s.fxPreset);
  const fxFlirPolarity = useAtlasStore((s) => s.fxFlirPolarity);
  const activeSidebarPanel = useAtlasStore((s) => s.activeSidebarPanel);
  const toggleMuted = useAtlasStore((s) => s.toggleMuted);
  const toggleShortcutHelp = useAtlasStore((s) => s.toggleShortcutHelp);
  const togglePanel = useAtlasStore((s) => s.togglePanel);
  const closeSidebarPanel = useAtlasStore((s) => s.closeSidebarPanel);
  const dataSource = useAtlasStore((s) => s.dataSource);
  const corpusStatus = useAtlasStore((s) => s.corpusStatus);
  const corpusError = useAtlasStore((s) => s.corpusError);
  const locationStats = useAtlasStore((s) => s.locationStats);
  const setDataSource = useAtlasStore((s) => s.setDataSource);
  const loadLiveCorpus = useAtlasStore((s) => s.loadLiveCorpus);

  const visible = getFilteredEntities();
  const assertionCount = visible.reduce((n, e) => n + e.assertions.length, 0);
  const conflictCount = visible.reduce(
    (n, e) => n + e.assertions.filter((a) => a.reconciliationStatus === 'conflicting').length,
    0,
  );

  const isoAgg = entities.flatMap((e) => e.assertions.map((a) => a.generatedAtTime)).sort();
  const lastEdited =
    isoAgg.length ? (isoAgg[isoAgg.length - 1]?.slice(0, 10) ?? '—') : '—';

  const viewKey =
    focusedView == null ? 'statusStripWorkspace'
    : focusedView === 'globe' ? 'viewGlobe'
    : focusedView === 'graph' ? 'viewGraph'
    : focusedView === 'documents' ? 'viewDocuments'
    : focusedView === 'time' ? 'viewTime'
    : focusedView === 'search' ? 'viewSearch'
    : focusedView === 'ai' ? 'viewAi'
    : 'viewOps';

  return (
    <header
      className="atlas-card pointer-events-auto absolute inset-x-2 top-2 z-40 flex items-center gap-2 px-2 md:gap-3 md:px-3"
      style={{ height: 'var(--atlas-bar-h, 40px)', minHeight: 'var(--atlas-bar-h, 40px)' }}
    >
      <div className="pointer-events-none hidden min-w-0 shrink flex-col justify-center leading-none lg:flex">
        <span className="truncate text-[11px] font-semibold tracking-tight text-foreground">
          {t('topTitle')}
        </span>
        <span className="truncate text-[10px] leading-tight text-muted-foreground">
          {dataSource === 'live' ? t('topSubtitleLive') : t('topSubtitle')}
        </span>
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center">
        <ToggleGroup
          type="single"
          value={dataSource}
          onValueChange={(v) => {
            if (v === 'demo' || v === 'live') {
              atlasSound.init();
              if (v === 'live' && dataSource !== 'live') loadLiveCorpus();
              else setDataSource(v);
            }
          }}
          className="h-7 gap-0.5"
        >
          <ToggleGroupItem value="demo" className="h-6 px-2 text-[9px] uppercase">
            {t('dataDemo')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="live"
            className="h-6 px-2 text-[9px] uppercase"
            disabled={corpusStatus === 'loading'}
          >
            {corpusStatus === 'loading' ? t('dataLoading') : t('dataLive')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-x-2 overflow-hidden font-mono text-[10px] uppercase tracking-wide text-muted-foreground md:gap-x-3">
        <span className="shrink-0 whitespace-nowrap text-foreground">
          {t('statusStripView')} <strong>{t(viewKey)}</strong>
        </span>
        <span className="hidden shrink-0 whitespace-nowrap sm:inline">{t('statusEntities', { count: visible.length })}</span>
        {dataSource === 'live' && locationStats ?
          <span className="hidden shrink-0 whitespace-nowrap md:inline" title={t('placesCoverageHint')}>
            {t('statusPlaces', {
              mapped: locationStats.mappedOnGlobe,
              total: locationStats.totalPlaces,
            })}
          </span>
        : null}
        <span className="hidden shrink-0 whitespace-nowrap lg:inline">{t('statusAssertions', { count: assertionCount })}</span>
        <span className="hidden shrink-0 whitespace-nowrap lg:inline">{t('statusCorpus', { count: entities.length })}</span>
        <span className="hidden shrink-0 whitespace-nowrap xl:inline">
          {t('floors')} {reliabilityFloor} · {(confidenceFloor * 100).toFixed(0)}%
        </span>
        <span className="hidden min-w-0 truncate normal-case tracking-normal opacity-80 2xl:inline">
          {t('globeImageryAttribution')}
        </span>
        <span className="hidden shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[10px] tabular-nums sm:flex">
          <span className="rounded border border-border/50 px-1 py-px">{FX_BADGE[fxPreset]}</span>
          {fxPreset === 'flir' ?
            <span className="text-muted-foreground">{fxFlirPolarity.toUpperCase()}</span>
          : null}
        </span>
      </div>

      <div className="pointer-events-none ml-auto flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground md:gap-3">
        <span className="hidden whitespace-nowrap sm:inline">
          {t('lastEdited')} {lastEdited}
        </span>
        <span
          className={
            'whitespace-nowrap ' +
            (conflictCount > 0 ?
              'animate-pulse rounded border border-destructive/60 px-1 py-px text-destructive'
            : '')
          }
        >
          {t('conflicts')} {conflictCount}
        </span>
        <span className="hidden whitespace-nowrap opacity-70 md:inline">1–6 · 7 · T</span>
        {corpusStatus === 'error' && corpusError ?
          <span className="max-w-[14rem] truncate text-destructive normal-case" title={corpusError}>
            {corpusError}
          </span>
        : null}
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-0.5 border-l border-border/50 pl-1.5 md:pl-2">
        {activeSidebarPanel ?
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => {
              atlasSound.init();
              closeSidebarPanel();
            }}
            aria-label={t('closeSidebarPanel')}
            title={t('closeSidebarPanel')}
          >
            <IconMinimize className="h-3.5 w-3.5" />
          </Button>
        : null}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 rounded-md"
              onClick={() => atlasSound.init()}
              aria-label={t('fxTitle')}
              title={t('fxTitle')}
            >
              <IconAperture className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-auto max-w-[min(22rem,92vw)] p-0">
            <div className="p-3">
              <FxControls variant="popover" />
            </div>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 rounded-md"
              onClick={() => atlasSound.init()}
              aria-label={t('spotlightTitle')}
              title={t('spotlightTitle')}
            >
              <IconFocus2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-auto max-w-[min(22rem,92vw)] p-0">
            <div className="p-3">
              <SpotlightControls variant="popover" />
            </div>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 rounded-md"
          onClick={() => {
            atlasSound.init();
            toggleMuted();
          }}
          aria-label={muted ? t('unmuteSounds') : t('muteSounds')}
          title="M"
        >
          {muted ? <IconVolumeOff className="h-3.5 w-3.5" /> : <IconVolume className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 rounded-md"
          onClick={() => {
            atlasSound.init();
            onToggleFullscreen?.();
          }}
          aria-label={isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}
          title="F"
        >
          {isFullscreen ?
            <IconMinimize className="h-3.5 w-3.5" />
          : <IconMaximize className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 rounded-md"
          onClick={() => {
            atlasSound.init();
            toggleShortcutHelp();
          }}
          aria-label={t('keyboardShortcuts')}
          title="?"
        >
          <IconHelp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 rounded-md"
          onClick={() => {
            atlasSound.init();
            togglePanel();
          }}
          aria-label={panelOpen ? t('hideDetailPanel') : t('showDetailPanel')}
          title="S"
        >
          {panelOpen ?
            <IconLayoutSidebarRightCollapse className="h-3.5 w-3.5" />
          : <IconLayoutSidebarRightExpand className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </header>
  );
}

