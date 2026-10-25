'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { IconAffiliate, IconMap2, IconPhoto, IconTimeline, type Icon } from '@tabler/icons-react';

import { LENSES, type Lens } from '@/lib/heritage-museum/museum-state';
import { cn } from '@/lib/utils';

const ICONS: Record<Lens, Icon> = {
  exhibit: IconPhoto,
  map: IconMap2,
  timeline: IconTimeline,
  connections: IconAffiliate,
};

export const LENS_PANEL_ID = 'museum-lens-panel';

interface LensTabsProps {
  lens: Lens;
  onLens: (lens: Lens) => void;
  /** What each lens has to show for the current filters, e.g. located records for the map. */
  counts: Partial<Record<Lens, number>>;
}

/**
 * The four ways to look at the collection. A WAI-ARIA tablist: arrow keys and
 * Home/End move between lenses, and the digits 1–4 work from anywhere on the
 * page (see the keyboard handler in the museum client).
 */
export function LensTabs({ lens, onLens, counts }: LensTabsProps) {
  const t = useTranslations('heritageMuseum.lenses');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (k: number) => {
    const i = (k + LENSES.length) % LENSES.length;
    refs.current[i]?.focus();
    onLens(LENSES[i]);
  };

  return (
    <div role="tablist" aria-label={t('label')} className="flex border border-story-rule bg-story-paper">
      {LENSES.map((l, i) => {
        const Icon = ICONS[l];
        const active = l === lens;
        const count = counts[l];
        return (
          <button
            key={l}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`museum-lens-${l}`}
            aria-selected={active}
            aria-controls={LENS_PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onLens(l)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') focusTab(i + 1);
              else if (e.key === 'ArrowLeft') focusTab(i - 1);
              else if (e.key === 'Home') focusTab(0);
              else if (e.key === 'End') focusTab(LENSES.length - 1);
              else return;
              e.preventDefault();
            }}
            className={cn(
              'inline-flex min-h-10 cursor-pointer items-center gap-2 border-r border-story-rule px-3 text-sm font-semibold last:border-r-0 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-story-accent sm:px-4',
              active ? 'bg-story-ink text-story-paper' : 'text-story-ink hover:bg-story-panel',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t(l)}</span>
            <span className="sr-only sm:hidden">{t(l)}</span>
            {count != null ? (
              <span className={cn('text-xs tabular-nums', active ? 'opacity-70' : 'text-story-ink-soft')}>{count}</span>
            ) : null}
            <kbd className={cn('hidden font-sans text-[10px] lg:inline', active ? 'opacity-60' : 'text-story-ink-soft')} aria-hidden>
              {i + 1}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}
