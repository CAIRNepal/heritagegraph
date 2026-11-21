import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { ERAS, type EraId } from '@/lib/heritage-atlas/atlas-model';

/** CSS variables (globals.css) holding each period's colour for "colour by period". */
export const ERA_COLOR_VARS: Record<EraId, string> = {
  early: '--atlas-era-early',
  licchavi: '--atlas-era-licchavi',
  transitional: '--atlas-era-transitional',
  malla: '--atlas-era-malla',
  shah: '--atlas-era-shah',
  undated: '--atlas-era-undated',
};

/** Resolved colours, for Leaflet, which writes fills as SVG attributes where var() does not apply. */
export function readEraColors(): Record<EraId, string> {
  const css = getComputedStyle(document.documentElement);
  const out = {} as Record<EraId, string>;
  for (const [id, v] of Object.entries(ERA_COLOR_VARS) as [EraId, string][]) out[id] = css.getPropertyValue(v).trim() || '#888';
  return out;
}

export function useAtlasWords() {
  const t = useTranslations('atlasMap');
  const eraName = useCallback((id: EraId) => t(`eras.${id}`), [t]);
  const eraSpan = useCallback(
    (id: EraId) => {
      const e = ERAS.find((x) => x.id === id)!;
      if (e.id === 'undated') return t('noDate');
      if (e.from == null) return t('spanTo', { year: e.to! });
      if (e.to == null) return t('spanFrom', { year: e.from });
      return `${e.from}–${e.to}`;
    },
    [t],
  );
  const km = useCallback((d: number) => (d < 1 ? t('sameSpot') : d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d)} km`), [t]);
  return { t, eraName, eraSpan, km };
}
