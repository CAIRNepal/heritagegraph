'use client';

import type { ReactNode } from 'react';

import type { AtlasEntity } from '@/types/atlas';

import type { ProvenanceSummary } from '../../hooks/use-atlas-store';
import { ATLAS_ERA_LABELS, centuryLabel, formatYear } from '../../lib/atlas-format';
import { CoordProvenanceBadge } from '../coord-provenance-badge';
import { markerStyleForEntity } from '../HeritageGlobe/marker-config';

interface QuickFactsProps {
  entity: AtlasEntity;
  provenance: ProvenanceSummary | null;
}

interface FactTileProps {
  label: string;
  children: ReactNode;
}

function FactTile({ label, children }: FactTileProps) {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/25 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </p>
      <div className="mt-0.5 text-[12px] font-medium leading-snug">{children}</div>
    </div>
  );
}

/** Compact fact grid: period, type, coordinates, confidence, provenance. */
export function QuickFacts({ entity, provenance }: QuickFactsProps) {
  const style = markerStyleForEntity(entity);
  const century = centuryLabel(entity.foundedYear);
  const sourceCount = new Set(entity.assertions.flatMap((a) => a.derivedFromSourceIds)).size;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <FactTile label="Category">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: style.color }} />
          {style.label}
        </span>
      </FactTile>
      <FactTile label="Era">{ATLAS_ERA_LABELS[entity.era]}</FactTile>
      {entity.foundedYear != null ? (
        <FactTile label="Founded">
          {formatYear(entity.foundedYear)}
          {century ? <span className="text-muted-foreground"> · {century}</span> : null}
        </FactTile>
      ) : null}
      {entity.lat != null && entity.lon != null ? (
        <FactTile label="Coordinates">
          <span className="font-mono text-[11px] tabular-nums">
            {entity.lat.toFixed(4)}°, {entity.lon.toFixed(4)}°
          </span>
          {entity.coordProvenance ? (
            <CoordProvenanceBadge provenance={entity.coordProvenance} compact className="ml-1.5" />
          ) : null}
        </FactTile>
      ) : (
        <FactTile label="Coordinates">
          <span className="text-muted-foreground">Catalog only — not yet mapped</span>
        </FactTile>
      )}
      {provenance && entity.assertions.length > 0 ? (
        <FactTile label="Confidence">
          {Math.round(provenance.avgConfidence * 100)}%
          {provenance.conflictCount > 0 ? (
            <span className="ml-1.5 rounded-md bg-red-500/15 px-1 py-px text-[10px] text-red-500">
              {provenance.conflictCount} conflict{provenance.conflictCount > 1 ? 's' : ''}
            </span>
          ) : null}
        </FactTile>
      ) : null}
      <FactTile label="Evidence">
        {entity.assertions.length} assertion{entity.assertions.length === 1 ? '' : 's'}
        {sourceCount > 0 ? (
          <span className="text-muted-foreground"> · {sourceCount} sources</span>
        ) : null}
      </FactTile>
      {entity.sourceLayer === 'lux' ? (
        <FactTile label="Layer">Yale LUX linked record</FactTile>
      ) : null}
      {entity.ritualType ? <FactTile label="Ritual type">{entity.ritualType}</FactTile> : null}
    </div>
  );
}
