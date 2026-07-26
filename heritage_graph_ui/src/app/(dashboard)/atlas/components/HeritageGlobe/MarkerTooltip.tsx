'use client';

import { AnimatePresence, motion } from 'framer-motion';

import { useAtlasStore } from '../../hooks/use-atlas-store';
import { ATLAS_ERA_LABELS, centuryLabel } from '../../lib/atlas-format';
import { markerStyleForEntity } from './marker-config';

/** Floating hover preview near the cursor: thumbnail, name, type, century. */
export function MarkerTooltip() {
  const hoveredEntityId = useAtlasStore((s) => s.hoveredEntityId);
  const hoverScreenPos = useAtlasStore((s) => s.hoverScreenPos);
  const getEntityById = useAtlasStore((s) => s.getEntityById);

  const entity = hoveredEntityId ? getEntityById(hoveredEntityId) : null;
  if (!entity || !hoverScreenPos) return null;

  const style = markerStyleForEntity(entity);
  const century = centuryLabel(entity.foundedYear);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const left = Math.min(hoverScreenPos.x + 18, vw - 300);
  const top = Math.min(hoverScreenPos.y + 18, vh - 190);

  return (
    <AnimatePresence>
      <motion.div
        key={entity.id}
        role="tooltip"
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 480, damping: 34 }}
        className="pointer-events-none fixed z-[70] w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220]/85 text-white shadow-2xl shadow-black/50 backdrop-blur-xl"
        style={{ left, top }}
      >
        {entity.imageUrl ? (
          <div className="relative h-28 w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote KG media */}
            <img
              src={entity.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220]/95 via-transparent to-transparent" />
          </div>
        ) : null}
        <div className="space-y-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">{entity.name}</p>
              {entity.nameNe ? (
                <p className="truncate text-xs text-white/55">{entity.nameNe}</p>
              ) : null}
            </div>
            <span
              className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: style.color }}
              />
              {entity.class}
            </span>
          </div>
          <p className="line-clamp-2 text-xs leading-snug text-white/60">{entity.summary}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5 text-[10px] text-white/45">
            {century ? <span>{century}</span> : null}
            <span>{ATLAS_ERA_LABELS[entity.era] ?? entity.era}</span>
            {entity.lat != null && entity.lon != null ? (
              <span className="font-mono tabular-nums">
                {entity.lat.toFixed(2)}°, {entity.lon.toFixed(2)}°
              </span>
            ) : null}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
