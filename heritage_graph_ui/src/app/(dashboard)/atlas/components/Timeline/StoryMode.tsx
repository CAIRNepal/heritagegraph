'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AtlasEntity } from '@/types/atlas';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import { ATLAS_ERA_LABELS, ATLAS_GLASS, centuryLabel, formatYear } from '../../lib/atlas-format';
import { markerStyleForEntity } from '../HeritageGlobe/marker-config';

const STOP_DURATION_MS = 11_000;
const MAX_STOPS = 12;

/**
 * Chooses journey stops: richly documented, mappable heritage ordered
 * chronologically — the camera travels through both space and time.
 */
export function buildJourneyStops(entities: AtlasEntity[]): string[] {
  return entities
    .filter((e) => e.lat != null && e.lon != null)
    .map((e) => ({
      e,
      score:
        (e.imageUrl ? 2 : 0) +
        (e.summary.length > 80 ? 1 : 0) +
        (e.assertions.length > 0 ? 1 : 0) +
        (e.events.length > 0 ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_STOPS)
    .sort((a, b) => (a.e.foundedYear ?? 3000) - (b.e.foundedYear ?? 3000))
    .map((s) => s.e.id);
}

/** Google Earth Voyager-style guided journey with narration and progress. */
export function StoryMode() {
  const story = useAtlasUiStore((s) => s.story);
  const stopStory = useAtlasUiStore((s) => s.stopStory);
  const setStoryIndex = useAtlasUiStore((s) => s.setStoryIndex);
  const setStoryPlaying = useAtlasUiStore((s) => s.setStoryPlaying);

  const getEntityById = useAtlasStore((s) => s.getEntityById);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const setCurrentYear = useAtlasStore((s) => s.setCurrentYear);

  const stopId = story.active ? story.stopIds[story.index] : null;
  const entity = stopId ? getEntityById(stopId) : undefined;

  // Each stop: fly the camera (via selection) and move the timeline to its period.
  useEffect(() => {
    if (!story.active || !stopId) return;
    selectEntity(stopId, false);
    const e = getEntityById(stopId);
    if (e?.foundedYear != null) setCurrentYear(e.foundedYear);
  }, [story.active, stopId, selectEntity, getEntityById, setCurrentYear]);

  // Auto-advance.
  useEffect(() => {
    if (!story.active || !story.playing) return;
    const t = window.setTimeout(() => {
      if (story.index >= story.stopIds.length - 1) {
        setStoryPlaying(false);
      } else {
        setStoryIndex(story.index + 1);
      }
    }, STOP_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [story.active, story.playing, story.index, story.stopIds.length, setStoryIndex, setStoryPlaying]);

  if (!story.active || !entity) return null;

  const style = markerStyleForEntity(entity);
  const century = centuryLabel(entity.foundedYear);
  const isLast = story.index >= story.stopIds.length - 1;

  return (
    <AnimatePresence>
      <motion.section
        key="story"
        initial={{ opacity: 0, y: 42 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 42 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        aria-label="Heritage journey"
        className={cn(
          ATLAS_GLASS,
          'pointer-events-auto absolute bottom-28 left-1/2 z-40 w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden',
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={entity.id}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -26 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
            className="flex gap-3.5 p-3.5"
          >
            {entity.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote KG media
              <img
                src={entity.imageUrl}
                alt={entity.name}
                className="h-28 w-28 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div
                className="h-28 w-28 shrink-0 rounded-xl"
                style={{
                  background: `radial-gradient(120% 120% at 30% 20%, ${style.color}44, ${style.color}11)`,
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Stop {story.index + 1} of {story.stopIds.length}
                {entity.foundedYear != null ? ` · ${formatYear(entity.foundedYear)}` : ''}
                {century ? ` · ${century}` : ''}
              </p>
              <h3 className="mt-0.5 truncate text-base font-semibold tracking-tight">
                {entity.name}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {entity.class} · {ATLAS_ERA_LABELS[entity.era]}
              </p>
              <p className="mt-1.5 line-clamp-3 text-[12px] leading-snug text-foreground/85">
                {entity.summary}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Progress + controls */}
        <div className="flex items-center gap-2 border-t border-border/40 px-3.5 py-2">
          <div className="flex flex-1 items-center gap-1" role="progressbar"
            aria-valuemin={1} aria-valuemax={story.stopIds.length} aria-valuenow={story.index + 1}>
            {story.stopIds.map((id, i) => (
              <button
                key={id}
                type="button"
                aria-label={`Go to stop ${i + 1}`}
                onClick={() => setStoryIndex(i)}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all',
                  i < story.index ? 'bg-primary/60'
                  : i === story.index ? 'bg-primary'
                  : 'bg-muted-foreground/20 hover:bg-muted-foreground/40',
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              type="button" variant="ghost" size="icon" aria-label="Previous stop"
              className="h-8 w-8 rounded-xl" disabled={story.index === 0}
              onClick={() => setStoryIndex(story.index - 1)}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <Button
              type="button" variant="ghost" size="icon"
              aria-label={story.playing ? 'Pause journey' : 'Resume journey'}
              className="h-8 w-8 rounded-xl bg-primary/15 text-primary"
              onClick={() => setStoryPlaying(!story.playing)}
            >
              {story.playing ? (
                <Pause className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
              ) : (
                <Play className="h-3.5 w-3.5 fill-current" strokeWidth={1.5} />
              )}
            </Button>
            <Button
              type="button" variant="ghost" size="icon" aria-label="Next stop"
              className="h-8 w-8 rounded-xl" disabled={isLast}
              onClick={() => setStoryIndex(story.index + 1)}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
            </Button>
            <Button
              type="button" variant="ghost" size="icon" aria-label="End journey"
              className="h-8 w-8 rounded-xl text-muted-foreground"
              onClick={stopStory}
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}
