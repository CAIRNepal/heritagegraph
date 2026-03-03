'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Locale, locales, LOCALE_COOKIE } from '@/i18n/routing';

/**
 * Language switcher dropdown.
 * Sets the NEXT_LOCALE cookie and refreshes the page to
 * pick up the new locale in server components.
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations('language');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchLocale(newLocale: Locale) {
    if (newLocale === locale) return;

    // Set cookie client-side
    document.cookie = `${LOCALE_COOKIE}=${newLocale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;

    // Refresh to apply new locale
    startTransition(() => {
      router.refresh();
    });
  }

  const localeLabels: Record<Locale, { label: string; flag: string }> = {
    en: { label: 'English', flag: '🇬🇧' },
    ne: { label: 'नेपाली', flag: '🇳🇵' },
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          disabled={isPending}
          aria-label={t('switchTo')}
        >
          <Globe className="h-4 w-4" />
          <span className="absolute -bottom-0.5 -right-0.5 text-[10px] font-bold leading-none bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded px-0.5">
            {locale === 'en' ? 'EN' : 'ने'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={loc === locale ? 'bg-accent font-medium' : ''}
          >
            <span className="mr-2">{localeLabels[loc].flag}</span>
            {localeLabels[loc].label}
            {loc === locale && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
