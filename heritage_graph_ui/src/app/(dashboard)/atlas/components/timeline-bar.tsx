'use client';

import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { atlasSound } from '@/lib/atlas-sound';

import { EraFilter } from './era-filter';
import { OntologyClassFilter } from './ontology-class-filter';
import { type GraphEdgeSlice, useAtlasStore } from '../hooks/use-atlas-store';

export function TimelineBar() {
  const t = useTranslations('Atlas');

  const minYear = useAtlasStore((s) => s.minYear);
  const maxYear = useAtlasStore((s) => s.maxYear);
  const currentYear = useAtlasStore((s) => s.currentYear);
  const playing = useAtlasStore((s) => s.playing);
  const setCurrentYear = useAtlasStore((s) => s.setCurrentYear);
  const togglePlaying = useAtlasStore((s) => s.togglePlaying);
  const selectedId = useAtlasStore((s) => s.selectedId);
  const getEntityById = useAtlasStore((s) => s.getEntityById);
  const focusedView = useAtlasStore((s) => s.focusedView);
  const graphEdgeSlice = useAtlasStore((s) => s.graphEdgeSlice);
  const setGraphEdgeSlice = useAtlasStore((s) => s.setGraphEdgeSlice);

  const entity = selectedId ? getEntityById(selectedId) : undefined;
  const span = maxYear - minYear || 1;
  const yearToPct = (y: number) => ((y - minYear) / span) * 100;
  const thumbPct = yearToPct(currentYear);

  const eventYears =
    entity?.events
      .map((ev) => ev.year)
      .filter((y) => y >= minYear && y <= maxYear) ?? [];

  return (
    <div
      className="atlas-card pointer-events-auto absolute z-20"
      style={{
        bottom: 'calc(0.5rem + var(--atlas-gutter-b, 0px))',
        left: 'calc(0.5rem + var(--atlas-gutter-l, 0px))',
        right: 'calc(0.5rem + var(--atlas-gutter-r, 0px))',
        minHeight: 'var(--atlas-dock-h, 80px)',
      }}
    >
      <div className="flex h-full flex-col justify-center gap-1 px-2 py-1 md:px-3">
        <div className="flex h-7 min-h-7 items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-7 w-7 shrink-0 rounded-md"
            onClick={() => {
              atlasSound.init();
              togglePlaying();
            }}
            aria-label={playing ? 'Pause timeline' : 'Play timeline'}
            title="Space"
          >
            {playing ?
              <IconPlayerPause className="h-3.5 w-3.5" />
            : <IconPlayerPlay className="h-3.5 w-3.5" />}
          </Button>

          <span className="hidden w-9 shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums sm:block">
            {minYear}
          </span>

          <div className="relative min-w-0 flex-1 px-1 pt-4">
            <div
              className="pointer-events-none absolute top-0 right-1 left-1 flex justify-between font-mono text-[9px] text-muted-foreground tabular-nums"
              aria-hidden
            >
              <span className="sm:hidden">{minYear}</span>
              <span className="sm:hidden">{maxYear}</span>
            </div>

            {/* Event ticks (selected entity) */}
            <div
              className="pointer-events-none absolute right-0 bottom-2.5 left-0 h-2"
              aria-hidden
            >
              {eventYears.map((y, tickIdx) => (
                <div
                  key={`tick-${entity?.id ?? 'none'}-${y}-${tickIdx}`}
                  className="absolute bottom-0 w-px translate-x-[-50%] bg-primary/70"
                  style={{
                    left: `${yearToPct(y)}%`,
                    height: y === currentYear ? '8px' : '5px',
                  }}
                />
              ))}
            </div>

            <span
              className="pointer-events-none absolute -top-0.5 rounded border border-border/60 bg-primary/90 px-1 py-px font-mono text-[10px] font-semibold text-primary-foreground shadow-sm tabular-nums"
              style={{
                left: `${thumbPct}%`,
                transform: 'translateX(-50%)',
              }}
            >
              {currentYear}
            </span>

            <Slider
              min={minYear}
              max={maxYear}
              step={1}
              value={[currentYear]}
              onValueChange={(v) => {
                const next = Array.isArray(v) ? v[0] ?? minYear : v;
                atlasSound.play('tick');
                setCurrentYear(Math.round(Number(next)));
              }}
              className="py-1"
              aria-label="Timeline scrubber"
            />
          </div>

          <span className="hidden w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums sm:block">
            {maxYear}
          </span>
        </div>

        <div className="flex h-6 min-h-6 flex-wrap items-center gap-2 border-t border-border/40 pt-1">
          <EraFilter dense className="min-w-0 flex-1" />
          <OntologyClassFilter dense className="shrink-0" />
          {focusedView === 'graph' ?
            <div className="flex shrink-0 items-center gap-1.5">
              <Label className="sr-only">{t('graphSlice')}</Label>
              <ToggleGroup
                type="single"
                value={graphEdgeSlice}
                onValueChange={(v: string) => {
                  if (v !== 'all' && v !== 'ritual_structure' && v !== 'guthi_structure') return;
                  setGraphEdgeSlice(v as GraphEdgeSlice);
                }}
                className="justify-start gap-0.5"
              >
                <ToggleGroupItem value="all" className="h-6 px-2 text-[10px]">
                  {t('sliceAll')}
                </ToggleGroupItem>
                <ToggleGroupItem value="ritual_structure" className="h-6 px-2 text-[10px]">
                  {t('sliceRitual')}
                </ToggleGroupItem>
                <ToggleGroupItem value="guthi_structure" className="h-6 px-2 text-[10px]">
                  {t('sliceGuthi')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          : null}
        </div>
      </div>
    </div>
  );
}
