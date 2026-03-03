/**
 * i18n configuration constants.
 * We use cookie-based locale detection (no URL prefix changes)
 * to avoid restructuring existing routes.
 */

export const locales = ['en', 'ne'] as const;
export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];

/** Cookie name used to persist the user's locale preference */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/** Nepali numeral mapping */
export const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'] as const;

/** Convert Arabic numerals to Devanagari */
export function toNepaliDigits(num: number | string): string {
  return String(num)
    .split('')
    .map((ch) => (/\d/.test(ch) ? NEPALI_DIGITS[parseInt(ch)] : ch))
    .join('');
}
