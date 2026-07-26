'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { AtlasEra, ReliabilityTier } from '@/types/atlas';
import { ONTOLOGY_CLASSES, RELIABILITY_ORDER } from '@/types/atlas';

import { ATLAS_ERAS_ORDER, useAtlasStore } from '../../hooks/use-atlas-store';
import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import { ATLAS_ERA_LABELS, ATLAS_GLASS } from '../../lib/atlas-format';

function allOn<T extends string>(keys: readonly T[]): Record<T, boolean> {
  return keys.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<T, boolean>);
}

/** Floating filter drawer: era, evidence confidence, source reliability, time. */
export function Filters() {
  const open = useAtlasUiStore((s) => s.filtersOpen);
  const setOpen = useAtlasUiStore((s) => s.setFiltersOpen);

  const eraEnabled = useAtlasStore((s) => s.eraEnabled);
  const toggleEra = useAtlasStore((s) => s.toggleEra);
  const temporalFilterEnabled = useAtlasStore((s) => s.temporalFilterEnabled);
  const setTemporalFilterEnabled = useAtlasStore((s) => s.setTemporalFilterEnabled);
  const confidenceFloor = useAtlasStore((s) => s.confidenceFloor);
  const reliabilityFloor = useAtlasStore((s) => s.reliabilityFloor);
  const dataSource = useAtlasStore((s) => s.dataSource);
  const liveScope = useAtlasStore((s) => s.liveScope);
  const setLiveScope = useAtlasStore((s) => s.setLiveScope);

  const resetFilters = () => {
    useAtlasStore.setState({
      eraEnabled: allOn(ATLAS_ERAS_ORDER as readonly AtlasEra[]),
      classEnabled: allOn(ONTOLOGY_CLASSES),
      confidenceFloor: 0,
      reliabilityFloor: 'D',
      temporalFilterEnabled: true,
    });
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.section
          key="filters"
          initial={{ opacity: 0, x: -18, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -18, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          aria-label="Filters"
          className={cn(
            ATLAS_GLASS,
            'pointer-events-auto absolute left-4 top-4 z-40 w-[288px] p-4 md:left-[304px]',
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">Filters</h3>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Reset filters"
                className="h-7 w-7 rounded-lg text-muted-foreground"
                onClick={resetFilters}
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close filters"
                className="h-7 w-7 rounded-lg text-muted-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Historical era
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(ATLAS_ERAS_ORDER as AtlasEra[]).map((era) => (
                  <button
                    key={era}
                    type="button"
                    aria-pressed={eraEnabled[era]}
                    onClick={() => toggleEra(era)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                      eraEnabled[era]
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border/50 bg-muted/30 text-muted-foreground/60 hover:text-muted-foreground',
                    )}
                  >
                    {ATLAS_ERA_LABELS[era]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium">Time travel filter</p>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Hide sites that did not yet exist at the timeline year
                </p>
              </div>
              <Switch
                checked={temporalFilterEnabled}
                onCheckedChange={setTemporalFilterEnabled}
                aria-label="Toggle time travel filter"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  Min. confidence
                </p>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {Math.round(confidenceFloor * 100)}%
                </span>
              </div>
              <Slider
                value={[confidenceFloor * 100]}
                min={0}
                max={90}
                step={5}
                aria-label="Minimum assertion confidence"
                onValueChange={([v]) =>
                  useAtlasStore.setState({ confidenceFloor: (v ?? 0) / 100 })
                }
              />
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Source reliability at least
              </p>
              <div className="grid grid-cols-4 gap-1">
                {[...RELIABILITY_ORDER].reverse().map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    aria-pressed={reliabilityFloor === tier}
                    onClick={() =>
                      useAtlasStore.setState({ reliabilityFloor: tier as ReliabilityTier })
                    }
                    className={cn(
                      'rounded-lg border py-1 font-mono text-[11px] transition-colors',
                      reliabilityFloor === tier
                        ? 'border-primary/40 bg-primary/15 text-primary'
                        : 'border-border/50 bg-muted/30 text-muted-foreground/70 hover:text-foreground',
                    )}
                  >
                    {tier}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground/60">
                D shows everything; A keeps only archival-grade sources.
              </p>
            </div>

            {dataSource === 'live' ? (
              <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3">
                <div>
                  <p className="text-[12px] font-medium">Curator preview</p>
                  <p className="text-[10px] text-muted-foreground">
                    Include unreviewed graph entities
                  </p>
                </div>
                <Switch
                  checked={liveScope === 'all'}
                  onCheckedChange={(v) => setLiveScope(v ? 'all' : 'reviewed')}
                  aria-label="Toggle curator preview scope"
                />
              </div>
            ) : null}
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
