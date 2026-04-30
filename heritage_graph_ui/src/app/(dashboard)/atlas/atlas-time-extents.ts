import type { AtlasEntity } from '@/types/atlas';

export function computeAtlasTimelineExtents(
  entities: AtlasEntity[],
): { minYear: number; maxYear: number } {
  const now = new Date().getFullYear();
  let minYear = Infinity;
  let maxYear = now;

  for (const e of entities) {
    if (e.foundedYear != null) {
      minYear = Math.min(minYear, e.foundedYear);
    }
    if (e.lastKnownExistenceYear != null) {
      maxYear = Math.max(maxYear, e.lastKnownExistenceYear);
    }
    for (const ev of e.events) {
      minYear = Math.min(minYear, ev.year);
      maxYear = Math.max(maxYear, ev.year);
    }
  }
  if (!Number.isFinite(minYear)) minYear = -800;
  return { minYear, maxYear: Math.max(maxYear, now) };
}
