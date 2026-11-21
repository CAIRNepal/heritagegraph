/**
 * Bikram Sambat (BS) Calendar Utilities
 *
 * Provides conversion between Gregorian (AD) and Bikram Sambat (BS)
 * calendar systems, along with Nepali-locale formatting helpers.
 *
 * Uses the `nepali-date-converter` package internally.
 */
import NepaliDate from 'nepali-date-converter';
import { toNepaliDigits } from '@/i18n/routing';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BSDate {
  year: number;
  month: number; // 1-indexed (1 = Baishakh)
  day: number;
}

export interface FormattedBSDate {
  /** e.g. "15 Baishakh 2083" */
  en: string;
  /** e.g. "१५ वैशाख २०८३" */
  ne: string;
  /** Raw numeric parts */
  raw: BSDate;
}

// ─── BS Month Names ─────────────────────────────────────────────────────────

export const BS_MONTHS_EN = [
  'Baishakh',
  'Jestha',
  'Ashadh',
  'Shrawan',
  'Bhadra',
  'Ashwin',
  'Kartik',
  'Mangsir',
  'Poush',
  'Magh',
  'Falgun',
  'Chaitra',
] as const;

export const BS_MONTHS_NE = [
  'वैशाख',
  'जेठ',
  'असार',
  'श्रावण',
  'भदौ',
  'असोज',
  'कार्तिक',
  'मंसिर',
  'पुष',
  'माघ',
  'फाल्गुन',
  'चैत्र',
] as const;

export const BS_DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const BS_DAYS_NE = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिहि', 'शुक्र', 'शनि'] as const;

// ─── Conversion Functions ───────────────────────────────────────────────────

/**
 * Convert a JS Date (Gregorian) to Bikram Sambat.
 */
export function adToBS(date: Date): BSDate {
  const nd = new NepaliDate(date);
  return {
    year: nd.getYear(),
    month: nd.getMonth() + 1, // NepaliDate months are 0-indexed
    day: nd.getDate(),
  };
}

/**
 * Convert Bikram Sambat date to Gregorian JS Date.
 */
export function bsToAD(bs: BSDate): Date {
  const nd = new NepaliDate(bs.year, bs.month - 1, bs.day);
  return nd.toJsDate();
}

/**
 * Get today's date in Bikram Sambat.
 */
export function todayBS(): BSDate {
  return adToBS(new Date());
}

// ─── Formatting Functions ───────────────────────────────────────────────────

/**
 * Format a BSDate for display in both English and Nepali.
 */
export function formatBSDate(bs: BSDate): FormattedBSDate {
  const monthEn = BS_MONTHS_EN[bs.month - 1];
  const monthNe = BS_MONTHS_NE[bs.month - 1];

  return {
    en: `${bs.day} ${monthEn} ${bs.year}`,
    ne: `${toNepaliDigits(bs.day)} ${monthNe} ${toNepaliDigits(bs.year)}`,
    raw: bs,
  };
}

/**
 * Format a Gregorian Date as Bikram Sambat string.
 *
 * @param date - Gregorian JS Date
 * @param locale - 'en' or 'ne'
 * @returns Formatted BS date string
 */
export function formatDateAsBS(date: Date, locale: 'en' | 'ne' = 'en'): string {
  const bs = adToBS(date);
  const formatted = formatBSDate(bs);
  return locale === 'ne' ? formatted.ne : formatted.en;
}

/**
 * Get a full formatted string with both AD and BS dates.
 * e.g., "3 Mar 2026 (15 Falgun 2082)"
 */
export function formatDualDate(
  date: Date,
  locale: 'en' | 'ne' = 'en'
): string {
  const bs = adToBS(date);
  const formatted = formatBSDate(bs);

  if (locale === 'ne') {
    const adFormatted = new Intl.DateTimeFormat('ne-NP', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
    return `${adFormatted} (${formatted.ne})`;
  }

  const adFormatted = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  return `${adFormatted} (${formatted.en})`;
}

/**
 * Format BS date as ISO-like string: "2083-01-15"
 */
export function formatBSISO(bs: BSDate): string {
  return `${bs.year}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')}`;
}

// ─── Relative Time (in Nepali) ──────────────────────────────────────────────

const NE_RELATIVE: Record<string, string> = {
  now: 'अहिले',
  seconds_ago: 'केही सेकेन्ड अगाडि',
  minute_ago: '१ मिनेट अगाडि',
  minutes_ago: ' मिनेट अगाडि',
  hour_ago: '१ घण्टा अगाडि',
  hours_ago: ' घण्टा अगाडि',
  day_ago: 'हिजो',
  days_ago: ' दिन अगाडि',
  month_ago: '१ महिना अगाडि',
  months_ago: ' महिना अगाडि',
  year_ago: '१ वर्ष अगाडि',
  years_ago: ' वर्ष अगाडि',
};

/**
 * Get relative time string in Nepali.
 */
export function relativeTimeNe(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 10) return NE_RELATIVE.now;
  if (seconds < 60) return NE_RELATIVE.seconds_ago;
  if (minutes === 1) return NE_RELATIVE.minute_ago;
  if (minutes < 60) return `${toNepaliDigits(minutes)}${NE_RELATIVE.minutes_ago}`;
  if (hours === 1) return NE_RELATIVE.hour_ago;
  if (hours < 24) return `${toNepaliDigits(hours)}${NE_RELATIVE.hours_ago}`;
  if (days === 1) return NE_RELATIVE.day_ago;
  if (days < 30) return `${toNepaliDigits(days)}${NE_RELATIVE.days_ago}`;
  if (months === 1) return NE_RELATIVE.month_ago;
  if (months < 12) return `${toNepaliDigits(months)}${NE_RELATIVE.months_ago}`;
  if (years === 1) return NE_RELATIVE.year_ago;
  return `${toNepaliDigits(years)}${NE_RELATIVE.years_ago}`;
}
