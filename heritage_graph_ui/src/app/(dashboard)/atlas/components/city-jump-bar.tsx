'use client';

import type { RefObject } from 'react';
import { useMemo, useState } from 'react';

import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import type { AtlasGlobeHandles } from '@/app/(dashboard)/atlas/globe-handles';

import { useAtlasStore } from '../hooks/use-atlas-store';
import {
  CURATED_CITIES,
  CURATED_CITY_ORDER,
  deriveDataDrivenCities,
  distanceEstimateKm,
  getCityById,
} from '../lib/atlas-cities';

function dedupeDerived(
  curated: typeof CURATED_CITIES,
  derived: ReturnType<typeof deriveDataDrivenCities>,
) {
  return derived.filter(
    (d) =>
      !curated.some((c) => distanceEstimateKm(c.lat, c.lon, d.lat, d.lon) < 15),
  );
}

interface CityJumpBarProps {
  globeHandlesRef: RefObject<AtlasGlobeHandles | null>;
}

export function CityJumpBar({ globeHandlesRef }: CityJumpBarProps) {
  const t = useTranslations('Atlas');
  const entities = useAtlasStore(useShallow((s) => s.entities));
  const cityPaletteOpen = useAtlasStore((s) => s.cityPaletteOpen);
  const setCityPaletteOpen = useAtlasStore((s) => s.setCityPaletteOpen);
  const selectCity = useAtlasStore((s) => s.selectCity);
  const selectedCityId = useAtlasStore((s) => s.selectedCityId);
  const selectEntity = useAtlasStore((s) => s.selectEntity);

  const mergedCities = useMemo(() => {
    const derived = dedupeDerived(CURATED_CITIES, deriveDataDrivenCities(entities));
    return [...CURATED_CITIES, ...derived];
  }, [entities]);

  const [q, setQ] = useState('');

  const filteredCities = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return mergedCities;
    return mergedCities.filter(
      (c) => c.label.toLowerCase().includes(qq) || c.id.toLowerCase().includes(qq),
    );
  }, [mergedCities, q]);

  const filteredEntities = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return [];
    return entities
      .filter(
        (e) =>
          e.name.toLowerCase().includes(qq) ||
          (e.nameNe?.toLowerCase().includes(qq) ?? false) ||
          e.id.toLowerCase().includes(qq),
      )
      .slice(0, 48);
  }, [entities, q]);

  const jumpCity = (id: string) => {
    selectCity(id);
    globeHandlesRef.current?.flyToCity(id);
    setCityPaletteOpen(false);
    setQ('');
  };

  const jumpEntity = (id: string) => {
    selectEntity(id);
    globeHandlesRef.current?.flyToEntity(id);
    setCityPaletteOpen(false);
    setQ('');
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
        <div className="shrink-0 space-y-0.5">
          <p className="text-[11px] font-semibold tracking-tight">{t('cityJumpTitle')}</p>
          <p className="font-mono text-[9px] uppercase text-muted-foreground">
            {t('cityPaletteShortcut')}
          </p>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-wrap gap-1 pb-2">
            {CURATED_CITY_ORDER.map((key) => {
              const c = getCityById(key);
              if (!c) return null;
              const active = selectedCityId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    'rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wide',
                    active ?
                      'border-primary bg-primary/15 text-foreground'
                    : 'border-border/50 bg-muted/35 text-muted-foreground hover:bg-muted/60',
                  )}
                  onClick={() => jumpCity(c.id)}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={cityPaletteOpen} onOpenChange={(o) => setCityPaletteOpen(o)}>
        <DialogContent className="max-h-[88vh] max-w-lg gap-3">
          <DialogHeader>
            <DialogTitle className="text-base">{t('cityPaletteTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            id="atlas-city-palette-input"
            placeholder={t('cityPalettePlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="font-mono text-sm"
          />
          <ScrollArea className="h-72 rounded-md border border-border/50">
            <div className="space-y-3 p-2">
              <div>
                <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">
                  {t('cityJumpTitle')}
                </p>
                <ul className="space-y-1">
                  {filteredCities.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col rounded-md border border-transparent px-2 py-1.5 text-left hover:border-border/60 hover:bg-muted/40"
                        onClick={() => jumpCity(c.id)}
                      >
                        <span className="text-[13px] font-medium">{c.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{c.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {filteredEntities.length ?
                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">
                    {t('cityEntitiesHeading')}
                  </p>
                  <ul className="space-y-1">
                    {filteredEntities.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col rounded-md border border-transparent px-2 py-1.5 text-left hover:border-border/60 hover:bg-muted/40"
                          onClick={() => jumpEntity(e.id)}
                        >
                          <span className="text-[13px] font-medium">{e.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {e.class} · {e.id}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              : q.trim().length > 0 ?
                <p className="text-xs text-muted-foreground">{t('cityNoEntityHits')}</p>
              : null}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
