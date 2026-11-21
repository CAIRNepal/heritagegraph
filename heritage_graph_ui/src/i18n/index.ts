/**
 * i18n barrel exports.
 * Import commonly used i18n utilities from this single module.
 */

// Config & constants
export { locales, defaultLocale, LOCALE_COOKIE, toNepaliDigits, NEPALI_DIGITS } from './routing';
export type { Locale } from './routing';

// Navigation (standard next/link + next/navigation re-exports)
export { Link, usePathname, useRouter, redirect } from './navigation';
