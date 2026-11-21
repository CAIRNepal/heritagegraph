'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MapCommand } from '@/app/(site)/atlas/components/AtlasMap';
import { readEraColors, useAtlasWords } from '@/app/(site)/atlas/components/atlas-words';
import { MapControls } from '@/app/(site)/atlas/components/MapChrome';
import { eraOf, type AtlasPlace, type EraId } from '@/lib/heritage-atlas/atlas-model';
import type { ReliefMeta } from '@/app/(site)/atlas/components/AtlasMap';

import { NODE_TYPE_CONFIG } from '../../heritage-data';
import { MandalaLoader } from '../MandalaLoader';

const AtlasMap = dynamic(() => import('@/app/(site)/atlas/components/AtlasMap').then((m) => m.AtlasMap), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <MandalaLoader />
    </div>
  ),
});

interface MapLensProps {
  /** Located records after search and filters. */
  places: AtlasPlace[];
  /** Records the filters let through that have no coordinates yet. */
  unlocated: number;
  selectedId: string | null;
  onSelect: (place: AtlasPlace) => void;
  /** Located records connected to the open one, drawn as lines with distances. */
  linked: AtlasPlace[];
  relief: ReliefMeta | null;
  /** False while the selection is only the page default: open on all of Nepal. */
  followSelection: boolean;
  /** A move asked for from outside the map, e.g. "show its connections". */
  command: (MapCommand & { n: number }) | null;
}

/**
 * The collection on a map of Nepal: terrain or streets, the whole country or
 * the Kathmandu Valley, coloured by kind or by period, with lines from the open
 * record to every located record it connects to.
 */
export function MapLens({ places, unlocated, selectedId, onSelect, linked, relief, followSelection, command }: MapLensProps) {
  const { t, km } = useAtlasWords();
  const [colorBy, setColorBy] = useState<'kind' | 'period'>('kind');
  const [basemap, setBasemap] = useState<'terrain' | 'streets'>('terrain');
  const [eraColors, setEraColors] = useState<Record<EraId, string> | null>(null);
  const [localCommand, setLocalCommand] = useState<(MapCommand & { n: number }) | null>(null);
  useEffect(() => setEraColors(readEraColors()), []);

  // The latest of the outside command and this lens's own extent buttons.
  const effectiveCommand = useMemo(() => {
    if (!command) return localCommand;
    if (!localCommand) return command;
    return localCommand.n > command.n ? localCommand : command;
  }, [command, localCommand]);
  const move = useCallback(
    (c: MapCommand) => setLocalCommand((prev) => ({ ...c, n: Math.max(prev?.n ?? 0, command?.n ?? 0) + 1 })),
    [command],
  );

  const colorOf = useCallback(
    (p: AtlasPlace) => (colorBy === 'kind' ? NODE_TYPE_CONFIG[p.node.nodeType]?.color ?? '#888' : eraColors?.[eraOf(p.year)] ?? '#888'),
    [colorBy, eraColors],
  );

  return (
    <section aria-label={t('mapAria', { count: places.length })} className="relative h-full min-h-[420px] bg-muted">
      <AtlasMap
        places={places}
        selectedId={selectedId}
        onSelect={onSelect}
        colorOf={colorOf}
        linked={linked}
        relief={relief}
        basemap={basemap}
        command={effectiveCommand}
        followSelection={followSelection}
        formatKm={km}
        labels={{ mapAria: t('mapAria', { count: places.length }), cluster: (n) => t('clusterAria', { count: n }), attribution: t('attribution') }}
      />
      <MapControls onExtent={(k) => move({ kind: k })} basemap={basemap} onBasemap={setBasemap} colorBy={colorBy} onColorBy={setColorBy} places={places} />
      {unlocated > 0 ? (
        <p className="pointer-events-none absolute bottom-2 left-2 z-[500] max-w-[60%] rounded-md bg-card/90 px-2 py-1 text-[11px] text-muted-foreground">
          {t('unlocatedNote', { count: unlocated })}
        </p>
      ) : null}
    </section>
  );
}
