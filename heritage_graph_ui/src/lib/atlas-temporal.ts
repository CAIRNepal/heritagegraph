import type { AtlasEntity } from '@/types/atlas';

/** Whether an entity plausibly existed at `year` (inclusive bounds). */
export function entityExistedAtYear(entity: AtlasEntity, year: number): boolean {
  const start = entity.foundedYear ?? entity.events.reduce((m, ev) => Math.min(m, ev.year), Infinity);
  if (Number.isFinite(start) && year < start) return false;

  const endCandidates: number[] = [];
  if (entity.lastKnownExistenceYear != null) endCandidates.push(entity.lastKnownExistenceYear);
  for (const ev of entity.events) endCandidates.push(ev.year);
  if (endCandidates.length === 0) return true;

  const end = Math.max(...endCandidates);
  return year <= end;
}

/** Whether the entity has at least one documented event on or before `year`. */
export function entityHasEventByYear(entity: AtlasEntity, year: number): boolean {
  return entity.events.some((ev) => ev.year <= year);
}

/**
 * Globe marker opacity by temporal proximity.
 * Entities without temporal bounds stay fully visible.
 */
export function temporalGlobeAlpha(entity: AtlasEntity, year: number): number {
  if (!entityExistedAtYear(entity, year)) return 0;
  if (entityHasEventByYear(entity, year)) return 1;

  const start = entity.foundedYear;
  if (start == null) return 0.72;

  const delta = Math.abs(year - start);
  if (delta <= 25) return 0.92;
  if (delta <= 80) return 0.78;
  return 0.55;
}
