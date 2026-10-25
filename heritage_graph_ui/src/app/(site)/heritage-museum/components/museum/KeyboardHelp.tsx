'use client';

import { useTranslations } from 'next-intl';
import { IconKeyboard } from '@tabler/icons-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const KEYS: [string, string][] = [
  ['1–4', 'lenses'],
  ['/', 'search'],
  ['← →', 'step'],
  ['↑ ↓', 'list'],
  ['Esc', 'endWalk'],
];

/** The page's shortcuts, one click away rather than printed on every control. */
export function KeyboardHelp() {
  const t = useTranslations('heritageMuseum.keys');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-9 cursor-pointer items-center justify-center border border-story-rule hover:bg-story-panel"
          aria-label={t('title')}
        >
          <IconKeyboard className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-none border-story-rule bg-story-paper text-story-ink">
        <p className="text-[11px] font-bold tracking-[0.14em] uppercase">{t('title')}</p>
        <dl className="mt-2 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          {KEYS.map(([key, what]) => (
            <div key={what} className="contents">
              <dt>
                <kbd className="border border-story-rule px-1.5 py-0.5 font-sans text-xs">{key}</kbd>
              </dt>
              <dd className="m-0">{t(what)}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
