import type { AtlasEra } from '@/types/atlas';

/** Shared glassmorphism shell for every floating atlas panel. */
export const ATLAS_GLASS =
  'rounded-2xl border border-border/40 bg-background/70 shadow-xl shadow-black/20 backdrop-blur-xl';

export const ATLAS_ERA_LABELS: Record<AtlasEra, string> = {
  ancient: 'Ancient · Licchavi',
  medieval: 'Medieval · Malla',
  early_modern: 'Early Modern · Shah',
  modern: 'Modern',
};

export function centuryLabel(year: number | undefined | null): string | null {
  if (year == null) return null;
  if (year <= 0) return `${Math.ceil((1 - year) / 100)}th century BCE`;
  const c = Math.ceil(year / 100);
  const suffix =
    c % 10 === 1 && c !== 11 ? 'st'
    : c % 10 === 2 && c !== 12 ? 'nd'
    : c % 10 === 3 && c !== 13 ? 'rd'
    : 'th';
  return `${c}${suffix} century`;
}

export function formatYear(year: number): string {
  return year <= 0 ? `${1 - year} BCE` : `${year} CE`;
}
