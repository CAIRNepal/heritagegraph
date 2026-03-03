'use client';

import { useLocale } from 'next-intl';
import { type Locale } from '@/i18n/routing';
import {
  adToBS,
  formatBSDate,
  formatDateAsBS,
  formatDualDate,
  relativeTimeNe,
  todayBS,
} from '@/lib/bikram-sambat';

/**
 * Hook for locale-aware date formatting with Bikram Sambat support.
 *
 * Usage:
 *   const { formatDate, formatRelative, today } = useLocaleDate();
 *   <span>{formatDate(someDate)}</span>
 *   <span>{formatRelative(someDate)}</span>
 *   <span>{today.display}</span>
 */
export function useLocaleDate() {
  const locale = useLocale() as Locale;

  /**
   * Format a date according to the current locale.
   * Shows BS date for Nepali, Gregorian for English.
   */
  function formatDate(date: Date, options?: { dual?: boolean }): string {
    if (options?.dual) {
      return formatDualDate(date, locale);
    }

    if (locale === 'ne') {
      return formatDateAsBS(date, 'ne');
    }

    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  /**
   * Format a date as a relative time string ("2 days ago" / "२ दिन अगाडि").
   */
  function formatRelative(date: Date): string {
    if (locale === 'ne') {
      return relativeTimeNe(date);
    }

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diffMs = Date.now() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return rtf.format(-diffSeconds, 'second');
    if (diffMinutes < 60) return rtf.format(-diffMinutes, 'minute');
    if (diffHours < 24) return rtf.format(-diffHours, 'hour');
    if (diffDays < 30) return rtf.format(-diffDays, 'day');
    if (diffDays < 365) return rtf.format(-Math.floor(diffDays / 30), 'month');
    return rtf.format(-Math.floor(diffDays / 365), 'year');
  }

  /**
   * Get today's date info.
   */
  const today = (() => {
    const bs = todayBS();
    const formatted = formatBSDate(bs);
    return {
      bs,
      display: locale === 'ne' ? formatted.ne : formatted.en,
      displayAlt: locale === 'ne' ? formatted.en : formatted.ne,
    };
  })();

  return {
    locale,
    formatDate,
    formatRelative,
    today,
    /** Raw conversion: Gregorian → BS */
    adToBS,
    /** Format any date as BS */
    formatDateAsBS: (date: Date) => formatDateAsBS(date, locale),
  };
}
