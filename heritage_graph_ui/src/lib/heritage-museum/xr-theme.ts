/**
 * Shared XR / immersive museum surface styles.
 * Uses semantic theme tokens so XR matches the dashboard in light and dark mode.
 */

import { useTranslations } from 'next-intl';

type MessageValues = Record<string, string | number | Date>;

/** XR copy lives under `heritageMuseum.xr.*` — use parent namespace for reliable resolution. */
export function useXrTranslations() {
  const t = useTranslations('heritageMuseum');
  return (key: string, values?: MessageValues) =>
    t(`xr.${key}` as Parameters<typeof t>[0], values);
}

/** Map empty-state copy under `heritageMuseum.map.*`. */
export function useMapTranslations() {
  const t = useTranslations('heritageMuseum');
  return (key: string, values?: MessageValues) =>
    t(`map.${key}` as Parameters<typeof t>[0], values);
}

/** Timeline copy under `heritageMuseum.timeline.*`. */
export function useTimelineTranslations() {
  const t = useTranslations('heritageMuseum');
  return (key: string, values?: MessageValues) =>
    t(`timeline.${key}` as Parameters<typeof t>[0], values);
}

export const xrGlassPanel =
  'rounded-2xl border border-border bg-card/90 backdrop-blur-xl shadow-lg';

export const xrSubtlePanel =
  'rounded-xl border border-border bg-card/75 backdrop-blur-md';

export const xrChip =
  'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground';

export const xrCinematicLeft =
  'pointer-events-none absolute inset-0 bg-gradient-to-r from-background/92 via-background/35 to-transparent';

export const xrCinematicBottom =
  'pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-background/25';

export const xrNavItemBase =
  'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
