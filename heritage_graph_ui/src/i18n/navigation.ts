/**
 * Re-export standard Next.js navigation utilities.
 *
 * Since we use cookie-based locale (no URL prefix),
 * standard next/link and next/navigation work as-is.
 * This module exists so components can import from a
 * single place if we ever switch to prefixed routing.
 */
export { default as Link } from 'next/link';
export { usePathname, useRouter, redirect } from 'next/navigation';
