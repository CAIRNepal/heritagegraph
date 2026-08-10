'use client';

import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';

import { useAtlasUiStore } from '../../hooks/use-atlas-ui-store';
import { ATLAS_GLASS } from '../../lib/atlas-format';
import { MARKER_ARCHETYPES } from '../HeritageGlobe/marker-config';

/** Marker colour legend, toggled from the layers drawer. */
export function Legend() {
  const t = useTranslations('Atlas');
  const show = useAtlasUiStore((s) => s.showLegend);

  return (
    <AnimatePresence>
      {show ? (
        <motion.aside
          key="legend"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          aria-label={t('legend.title')}
          className={cn(
            ATLAS_GLASS,
            'pointer-events-auto absolute bottom-28 left-1/2 z-20 hidden -translate-x-1/2 px-4 py-2.5 lg:block',
          )}
        >
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {MARKER_ARCHETYPES.map((style) => (
              <li key={style.id} className="flex items-center gap-1.5 text-[11px] text-foreground/85">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: style.color, boxShadow: `0 0 6px ${style.color}88` }}
                />
                {style.label}
              </li>
            ))}
          </ul>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
