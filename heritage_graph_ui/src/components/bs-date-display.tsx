'use client';

import { useLocale, useTranslations } from 'next-intl';
import { todayBS, formatBSDate, formatDateAsBS, formatDualDate, relativeTimeNe } from '@/lib/bikram-sambat';
import type { Locale } from '@/i18n/routing';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BSDateDisplayProps {
  /** Gregorian date to display. Defaults to now. */
  date?: Date;
  /** Show both AD and BS */
  dual?: boolean;
  /** Show relative time */
  relative?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays date in Bikram Sambat format when locale is Nepali,
 * or Gregorian when English — with hover tooltip showing the other.
 */
export function BSDateDisplay({
  date = new Date(),
  dual = false,
  relative = false,
  className = '',
}: BSDateDisplayProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations('calendar');

  if (dual) {
    return (
      <span className={className}>
        {formatDualDate(date, locale)}
      </span>
    );
  }

  // Primary display: BS for ne, Gregorian for en
  const primaryText = locale === 'ne'
    ? formatDateAsBS(date, 'ne')
    : new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);

  // Tooltip: the opposite
  const tooltipText = locale === 'ne'
    ? new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
    : formatDateAsBS(date, 'en');

  if (relative) {
    const relText = locale === 'ne'
      ? relativeTimeNe(date)
      : new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
          -Math.round((Date.now() - date.getTime()) / 86400000),
          'day'
        );

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`cursor-help ${className}`}>{relText}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{primaryText}</p>
            <p className="text-xs text-muted-foreground">
              {locale === 'ne' ? t('gregorian') : t('bikramSambat')}: {tooltipText}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`cursor-help ${className}`}>{primaryText}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {locale === 'ne' ? t('gregorian') : t('bikramSambat')}: {tooltipText}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Displays today's date in BS format — useful for headers/dashboards.
 */
export function TodayBSBadge({ className = '' }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('calendar');
  const today = todayBS();
  const formatted = formatBSDate(today);

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 text-xs font-medium text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 ${className}`}
    >
      <span>📅</span>
      <span>{locale === 'ne' ? formatted.ne : formatted.en}</span>
      <span className="text-orange-400 dark:text-orange-600">
        ({t('bikramSambat')})
      </span>
    </div>
  );
}
