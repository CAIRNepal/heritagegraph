'use client';

import { useTranslations } from 'next-intl';
import { IconAlertTriangle } from '@tabler/icons-react';

import { useAtlasStore } from '../hooks/use-atlas-store';

/**
 * Always-visible marker that the globe is showing the fictional sample corpus.
 *
 * The only previous indicator was an 11px text button inside the explorer
 * sidebar, which is `hidden md:flex` — so on a phone, or with the explorer
 * collapsed, nothing distinguished invented heritage from real records. This
 * banner is fixed to the top of the atlas surface, is not dismissible, and does
 * not live inside any collapsible panel.
 */
export function SampleDataBanner() {
  const t = useTranslations('Atlas.sampleBanner');
  const dataSource = useAtlasStore((s) => s.dataSource);

  if (dataSource !== 'demo') return null;

  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-3 pt-3"
    >
      <p className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 text-[11px] font-medium leading-tight text-amber-900 backdrop-blur-md sm:text-xs dark:text-amber-200">
        <IconAlertTriangle className="size-3.5 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">{t('label')}</span> {t('body')}
        </span>
      </p>
    </div>
  );
}
